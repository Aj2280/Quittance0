/**
 * Issue #508 - a wallet switch or disconnect cancels in-flight pay/verify
 * work owned by the previous public key.
 *
 * The pages are mounted through the same esbuild/jsdom harness the
 * accessibility audit uses, so what is asserted is shipped behaviour: a
 * verify started under wallet A may not complete its UI under wallet B, the
 * pending hash is dropped for the new session, and reconnecting the same key
 * leaves a clean, working page.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');

const { loadBundle, installDom, render } = require('./support/a11y-harness');

installDom();
const bundle = loadBundle();

const ALICE = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const BOB = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const TX_HASH = 'a'.repeat(64);

function pendingInvoice() {
  return {
    id: 'inv_a11y_fixture',
    sellerPublicKey: ALICE,
    amount: 42.5,
    assetCode: 'XLM',
    memo: 'QTN-inv_a11y_fixture',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
  };
}

function primePayPage() {
  bundle.resetResponses();
  bundle.setResponse(`/invoices/${pendingInvoice().id}/payment-info`, {
    data: { paymentUrl: 'https://quittance.test/pay/inv_a11y_fixture' },
  });
  bundle.setResponse(`/invoices/${pendingInvoice().id}`, { data: pendingInvoice() });
  bundle.setResponse(`/invoices/${pendingInvoice().id}/verify`, {
    data: { ...pendingInvoice(), status: 'PAID', paymentTxHash: TX_HASH },
  });
}

/** The verify POST settles the invoice server-side; subsequent reads see PAID. */
function primeInvoiceAsPaid() {
  bundle.setResponse(`/invoices/${pendingInvoice().id}`, {
    data: { ...pendingInvoice(), status: 'PAID', paymentTxHash: TX_HASH },
  });
}

function setWallet(overrides) {
  bundle.useWalletStore.setState({
    publicKey: null,
    balance: '0',
    connected: false,
    network: null,
    networkPassphrase: null,
    freighterAvailable: undefined,
    ...overrides,
  });
}

function walletOnTestnet(publicKey) {
  setWallet({
    publicKey,
    balance: '100.00',
    connected: true,
    network: 'TESTNET',
    networkPassphrase: TESTNET_PASSPHRASE,
    freighterAvailable: true,
  });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 25));

/** React reads `value` through its own setter, so a plain assignment is ignored. */
function setInputValue(element, value) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  descriptor.set.call(element, value);
  element.dispatchEvent(new window.Event('input', { bubbles: true }));
}

function verifyControls(container) {
  const input = container.querySelector('input[aria-label="Transaction hash"]');
  const button = [...container.querySelectorAll('button')].find((node) =>
    /verify/i.test(node.textContent)
  );
  return { input, button };
}

test('a verify started by wallet A cannot complete under wallet B', async () => {
  primePayPage();
  walletOnTestnet(ALICE);

  const { container, unmount } = await render(React.createElement(bundle.PayPage));
  try {
    await settle();

    const { input, button } = verifyControls(container);
    assert.ok(input, 'the transaction hash field rendered');
    assert.ok(button, 'the verify control rendered');

    setInputValue(input, TX_HASH);
    await settle();
    // The ledger is about to settle: even the follow-up reload returns PAID,
    // so any PAID rendering can only come from wallet A's in-flight verify.
    primeInvoiceAsPaid();
    button.click();

    // The wallet switches while the verify request is in flight.
    walletOnTestnet(BOB);
    await settle();

    assert.doesNotMatch(
      container.textContent,
      /Payment confirmed/i,
      "wallet A's verify result must not settle the page under wallet B"
    );
    assert.equal(input.value, '', "the previous session's hash is dropped");
    assert.equal(button.disabled, false, 'the new session can verify cleanly');
  } finally {
    unmount();
  }
});

test('disconnecting mid-verify cancels the request', async () => {
  primePayPage();
  walletOnTestnet(ALICE);

  const { container, unmount } = await render(React.createElement(bundle.PayPage));
  try {
    await settle();

    const { input, button } = verifyControls(container);
    assert.ok(input && button, 'the verify controls rendered');

    setInputValue(input, TX_HASH);
    await settle();
    button.click();

    setWallet({});
    await settle();

    assert.doesNotMatch(
      container.textContent,
      /Payment confirmed/i,
      'a disconnected session must not observe the verify result'
    );
  } finally {
    unmount();
  }
});

test('reconnecting the same key resumes a clean session for the invoice', async () => {
  primePayPage();
  walletOnTestnet(ALICE);

  const { container, unmount } = await render(React.createElement(bundle.PayPage));
  try {
    await settle();

    // Drop the first attempt by disconnecting while it is in flight.
    const first = verifyControls(container);
    setInputValue(first.input, TX_HASH);
    await settle();
    first.button.click();
    setWallet({});
    await settle();

    // The same key reconnects: a fresh verify reaches the backend and settles.
    walletOnTestnet(ALICE);
    await settle();

    const second = verifyControls(container);
    assert.ok(second.input, 'the verify controls are back for the same key');
    setInputValue(second.input, TX_HASH);
    await settle();
    primeInvoiceAsPaid();
    second.button.click();
    await settle();

    assert.match(
      container.textContent,
      /Payment confirmed/i,
      'the same key can verify after reconnecting'
    );
  } finally {
    unmount();
  }
});
