/**
 * Mobile wallet handoff return (issue #516).
 *
 * A wallet that leaves the browser to sign can bring the payer back to
 * `/pay/[id]?tx=<hash>`. The contract under test:
 *
 *  - `tx` must pass `checkTxHash` before it starts verification — anything
 *    else in that slot is ignored, not trusted.
 *  - `return_url`/`callback`/`redirect*` parameters pointing at another
 *    origin are refused, so the pay page never becomes an open redirect.
 *  - The sessionStorage resume pair is invoice id + last hash only — public
 *    data, never keys, signatures or tokens.
 *  - Mounted end to end: a valid `?tx=` verifies without a paste; a stored
 *    hash without `?tx=` shows the resume copy instead.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildPayCallbackUrl,
  isAllowedPayReturnUrl,
  parsePayReturnSearch,
} = require('../lib/pay-return');
const {
  PAY_SESSION_KEY,
  loadPaySession,
  savePaySession,
  clearPaySession,
} = require('../lib/pay-session');

const ORIGIN = 'https://quittance.test';
const INVOICE_ID = 'inv_a11y_fixture';
const TX = 'a'.repeat(64);
const TX_2 = 'b'.repeat(64);

test('isAllowedPayReturnUrl allows only same-origin /pay/ URLs', () => {
  assert.equal(isAllowedPayReturnUrl(`${ORIGIN}/pay/${INVOICE_ID}`, ORIGIN), true);
  assert.equal(isAllowedPayReturnUrl(`${ORIGIN}/pay/${INVOICE_ID}?tx=${TX}`, ORIGIN), true);
  assert.equal(isAllowedPayReturnUrl('https://evil.example/pay/x', ORIGIN), false);
  assert.equal(isAllowedPayReturnUrl(`${ORIGIN}/invoice/${INVOICE_ID}`, ORIGIN), false);
  assert.equal(isAllowedPayReturnUrl(`${ORIGIN}/pay/`, ORIGIN), false);
  assert.equal(isAllowedPayReturnUrl('javascript:alert(1)', ORIGIN), false);
  assert.equal(isAllowedPayReturnUrl('not a url', ORIGIN), false);
  assert.equal(isAllowedPayReturnUrl('', ORIGIN), false);
  assert.equal(isAllowedPayReturnUrl(null, ORIGIN), false);
  // A lookalike subdomain or userinfo trick is still another origin.
  assert.equal(isAllowedPayReturnUrl('https://quittance.test.evil.example/pay/x', ORIGIN), false);
  assert.equal(isAllowedPayReturnUrl('https://user@quittance.test.evil.example/pay/x', ORIGIN), false);
});

test('buildPayCallbackUrl emits this origin\'s pay path only', () => {
  assert.equal(
    buildPayCallbackUrl(ORIGIN, INVOICE_ID),
    `${ORIGIN}/pay/${INVOICE_ID}`
  );
  assert.equal(buildPayCallbackUrl(ORIGIN, ''), null);
  assert.equal(buildPayCallbackUrl('not an origin', INVOICE_ID), null);
});

test('parsePayReturnSearch trusts a valid tx hash', () => {
  const parsed = parsePayReturnSearch(`?tx=${TX}`, ORIGIN);
  assert.equal(parsed.txHash, TX);
  assert.deepEqual(parsed.ignored, []);
});

test('parsePayReturnSearch ignores a malformed tx hash', () => {
  const parsed = parsePayReturnSearch('?tx=not-a-hash', ORIGIN);
  assert.equal(parsed.txHash, null);
  assert.deepEqual(parsed.ignored, ['tx']);
});

test('parsePayReturnSearch refuses an off-origin return_url', () => {
  const parsed = parsePayReturnSearch(
    `?tx=${TX}&return_url=${encodeURIComponent('https://evil.example/steal')}`,
    ORIGIN
  );
  assert.equal(parsed.txHash, TX);
  assert.deepEqual(parsed.ignored, ['return_url']);
});

test('parsePayReturnSearch refuses foreign callback and redirect params', () => {
  const parsed = parsePayReturnSearch(
    `?callback=${encodeURIComponent('https://evil.example')}&redirect_uri=${encodeURIComponent('https://evil.example/back')}`,
    ORIGIN
  );
  assert.equal(parsed.txHash, null);
  assert.deepEqual(parsed.ignored, ['callback', 'redirect_uri']);
});

test('parsePayReturnSearch accepts a same-origin return_url', () => {
  const parsed = parsePayReturnSearch(
    `?return_url=${encodeURIComponent(`${ORIGIN}/pay/${INVOICE_ID}`)}`,
    ORIGIN
  );
  assert.deepEqual(parsed.ignored, []);
});

test('parsePayReturnSearch tolerates an empty or absent query', () => {
  assert.deepEqual(parsePayReturnSearch('', ORIGIN), { txHash: null, ignored: [] });
  assert.deepEqual(parsePayReturnSearch(undefined, ORIGIN), { txHash: null, ignored: [] });
});

test('pay session persists only the non-secret invoice+hash pair', async () => {
  const { installDom } = require('./support/a11y-harness');
  installDom();
  const store = window.sessionStorage;

  clearPaySession();
  assert.deepEqual(loadPaySession(), {});

  savePaySession({ invoiceId: INVOICE_ID, txHash: TX });
  assert.deepEqual(loadPaySession(), { invoiceId: INVOICE_ID, txHash: TX });

  // Extra fields are not picked up — the field list is closed.
  store.setItem(
    PAY_SESSION_KEY,
    JSON.stringify({ invoiceId: INVOICE_ID, txHash: TX, privateKey: 'SECRET' })
  );
  assert.deepEqual(loadPaySession(), { invoiceId: INVOICE_ID, txHash: TX });

  // Missing fields clear rather than write a half-session.
  savePaySession({ invoiceId: INVOICE_ID });
  assert.deepEqual(loadPaySession(), {});
  assert.equal(store.getItem(PAY_SESSION_KEY), null);

  // Malformed JSON is ignored, not thrown.
  store.setItem(PAY_SESSION_KEY, '{not json');
  assert.deepEqual(loadPaySession(), {});

  savePaySession({ invoiceId: INVOICE_ID, txHash: TX_2 });
  clearPaySession();
  assert.deepEqual(loadPaySession(), {});
});

test('SEP-0007 uri embeds the return callback as url:', () => {
  const { buildSep0007PayUri } = require('../lib/mobile-detection');
  const uri = buildSep0007PayUri({
    destination: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ',
    amount: '10.0000000',
    memo: 'INV-TEST',
    callback: `${ORIGIN}/pay/${INVOICE_ID}`,
  });
  const params = new URLSearchParams(uri.split('?')[1]);
  assert.equal(params.get('callback'), `url:${ORIGIN}/pay/${INVOICE_ID}`);
});

test('SEP-0007 uri omits the callback when none is given', () => {
  const { buildSep0007PayUri } = require('../lib/mobile-detection');
  const uri = buildSep0007PayUri({
    destination: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ',
    amount: '10.0000000',
  });
  assert.ok(!uri.includes('callback'));
});

// --- mounted: the pay page against the real bundle -------------------------

const {
  loadBundle,
  installDom,
  render,
} = require('./support/a11y-harness');

const React = require('react');

function invoiceFixture(overrides = {}) {
  return {
    id: INVOICE_ID,
    sellerPublicKey: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ',
    amount: '10.0000000',
    assetCode: 'XLM',
    memo: 'INV-RETURN-TEST',
    status: 'PENDING',
    paymentTxHash: null,
    createdAt: '2026-03-01T10:00:00.000Z',
    expiresAt: '2099-03-08T10:00:00.000Z',
    ...overrides,
  };
}

function primeApi(invoice, verifyPayload) {
  const bundle = loadBundle();
  bundle.resetResponses();
  bundle.setResponse(`/invoices/${INVOICE_ID}/payment-info`, {
    data: { paymentUrl: `${ORIGIN}/pay/${INVOICE_ID}` },
  });
  bundle.setResponse(`/invoices/${INVOICE_ID}`, { data: invoice });
  if (verifyPayload !== undefined) {
    bundle.setResponse(`/invoices/${INVOICE_ID}/verify`, { data: verifyPayload });
  }
}

test.beforeEach(() => {
  installDom();
  window.sessionStorage.clear();
  globalThis.__PAY_PAGE_SEARCH__ = '';
  loadBundle().resetResponses();
  loadBundle().resetCalls();
});

test.afterEach(() => {
  globalThis.__PAY_PAGE_SEARCH__ = '';
  window.sessionStorage.clear();
});

/** Extra macrotask turns for the return flow: load → verify is one hop longer. */
async function flushMore(turns = 8) {
  const { act } = React;
  for (let i = 0; i < turns; i += 1) {
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
  }
}

test('a valid ?tx= return starts verification without a paste', async () => {
  const bundle = loadBundle();
  // The settled fixture mirrors the real backend: once verify commits the
  // payment, the refetch inside verify returns PAID, not the stale PENDING.
  const paid = invoiceFixture({ status: 'PAID', paymentTxHash: TX, paidAt: '2026-03-02T12:30:00.000Z' });
  primeApi(paid, paid);
  globalThis.__PAY_PAGE_SEARCH__ = `?tx=${TX}`;

  const { container, unmount } = await render(React.createElement(bundle.PayPage));
  await flushMore();
  try {
    // Proof the handoff ran: a verify POST for this invoice was issued by the
    // page itself — no input, no click.
    assert.ok(
      bundle.getCalls().some((call) => call === `POST /invoices/${INVOICE_ID}/verify`),
      `auto-verify never fired; calls: ${JSON.stringify(bundle.getCalls())}`
    );
    const result = container.querySelector('#payment-result');
    assert.ok(result, 'no payment result region rendered');
    assert.match(result.textContent, /Payment confirmed/i);
    assert.ok(
      result.getAttribute('aria-live'),
      'the resumed result is not announced by a live region'
    );
    // The resumed session kept the hash for a follow-up visit.
    assert.equal(loadPaySession().txHash, TX);
  } finally {
    unmount();
  }
});

test('a malformed ?tx= is ignored rather than verified', async () => {
  const bundle = loadBundle();
  primeApi(invoiceFixture());
  globalThis.__PAY_PAGE_SEARCH__ = '?tx=definitely-not-a-hash';

  const { container, unmount } = await render(React.createElement(bundle.PayPage));
  try {
    assert.equal(container.querySelector('#payment-result'), null);
    const input = container.querySelector('input[aria-label="Transaction hash"]');
    assert.ok(input, 'verify input missing');
    assert.equal(input.value, '');
  } finally {
    unmount();
  }
});

test('a foreign return_url is ignored and never navigated to', async () => {
  const bundle = loadBundle();
  primeApi(invoiceFixture());
  globalThis.__PAY_PAGE_SEARCH__ =
    `?return_url=${encodeURIComponent('https://evil.example/steal')}&tx=${TX}`;
  const before = window.location.href;

  const { unmount } = await render(React.createElement(bundle.PayPage));
  try {
    assert.equal(window.location.href, before, 'the page navigated to a crafted return_url');
  } finally {
    unmount();
  }
});

test('a stored session hash shows the resume copy without auto-verifying', async () => {
  const bundle = loadBundle();
  primeApi(invoiceFixture());
  window.sessionStorage.setItem(
    PAY_SESSION_KEY,
    JSON.stringify({ invoiceId: INVOICE_ID, txHash: TX })
  );
  globalThis.__PAY_PAGE_SEARCH__ = '';

  const { container, unmount } = await render(React.createElement(bundle.PayPage));
  try {
    const input = container.querySelector('input[aria-label="Transaction hash"]');
    assert.ok(input, 'verify input missing');
    assert.equal(input.value, TX, 'stored hash was not restored into the input');
    assert.match(container.textContent, /Welcome back/i, 'resume copy missing');
    // No auto-verify: no result region until the payer asks.
    assert.equal(container.querySelector('#payment-result'), null);
  } finally {
    unmount();
  }
});

test('a stored session for another invoice is not applied', async () => {
  const bundle = loadBundle();
  primeApi(invoiceFixture());
  window.sessionStorage.setItem(
    PAY_SESSION_KEY,
    JSON.stringify({ invoiceId: 'inv_someone_else', txHash: TX })
  );

  const { container, unmount } = await render(React.createElement(bundle.PayPage));
  try {
    const input = container.querySelector('input[aria-label="Transaction hash"]');
    assert.ok(input, 'verify input missing');
    assert.equal(input.value, '');
    assert.ok(!/Welcome back/i.test(container.textContent));
  } finally {
    unmount();
  }
});
