const test = require('node:test');
const assert = require('node:assert/strict');

const {
  accountHasTrustline,
  classifyAccountLookupError,
  classifyTrustlinePreflight,
  trustlinePreflightMessage,
} = require('../lib/trustline-preflight.ts');

const USDC_ISSUER = 'G' + 'D'.repeat(55);

const fundedWithUsdc = {
  balances: [
    { asset_type: 'native' },
    { asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: USDC_ISSUER, balance: '10.0000000' },
  ],
};

const fundedWithoutUsdc = {
  balances: [
    { asset_type: 'native' },
    { asset_type: 'credit_alphanum4', asset_code: 'EURC', asset_issuer: USDC_ISSUER, balance: '3.0000000' },
  ],
};

test('native XLM never needs a trustline check', () => {
  assert.deepEqual(
    classifyTrustlinePreflight({ assetCode: 'XLM' }),
    { ok: true, code: 'NATIVE_ASSET' }
  );
  assert.equal(accountHasTrustline(fundedWithoutUsdc, 'XLM', ''), false);
});

test('an account holding the asset passes the preflight', () => {
  const result = classifyTrustlinePreflight({
    assetCode: 'USDC',
    assetIssuer: USDC_ISSUER,
    account: fundedWithUsdc,
  });
  assert.equal(result.ok, true);
  assert.equal(result.code, 'OK');
});

test('a funded account without the trustline is blocked as MISSING_TRUSTLINE', () => {
  const result = classifyTrustlinePreflight({
    assetCode: 'USDC',
    assetIssuer: USDC_ISSUER,
    account: fundedWithoutUsdc,
    networkLabel: 'testnet',
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'MISSING_TRUSTLINE');
  assert.equal(result.retryable, undefined);
  assert.match(result.message, /USDC trustline/);
  assert.match(result.message, /testnet/);
});

test('a same-code trustline under a different issuer does not count', () => {
  const otherIssuer = { balances: [{ asset_type: 'credit_alphanum4', asset_code: 'USDC', asset_issuer: 'G' + 'E'.repeat(55) }] };
  const result = classifyTrustlinePreflight({
    assetCode: 'USDC',
    assetIssuer: USDC_ISSUER,
    account: otherIssuer,
  });
  assert.equal(result.code, 'MISSING_TRUSTLINE');
});

test('a missing asset issuer can never prove the trustline', () => {
  const result = classifyTrustlinePreflight({ assetCode: 'USDC', account: fundedWithUsdc });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'MISSING_TRUSTLINE');
});

test('a 404 account lookup means unfunded, not trustline-verified', () => {
  const notFound = Object.assign(new Error('Not Found'), { response: { status: 404 } });
  assert.equal(classifyAccountLookupError(notFound), 'ACCOUNT_NOT_FOUND');
  const result = classifyTrustlinePreflight({
    assetCode: 'USDC',
    assetIssuer: USDC_ISSUER,
    error: notFound,
    networkLabel: 'testnet',
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'ACCOUNT_NOT_FOUND');
  assert.equal(result.retryable, false);
  assert.match(result.message, /not funded/);
});

test('a Horizon outage is retryable and never a fake pass', () => {
  const outage = Object.assign(new Error('timeout of 8000ms exceeded'), { code: 'ECONNABORTED' });
  assert.equal(classifyAccountLookupError(outage), 'HORIZON_UNAVAILABLE');
  const result = classifyTrustlinePreflight({
    assetCode: 'USDC',
    assetIssuer: USDC_ISSUER,
    error: outage,
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'HORIZON_UNAVAILABLE');
  assert.equal(result.retryable, true);
  assert.match(result.message, /try again/i);
});

test('a 5xx Horizon response classifies as outage', () => {
  const err = Object.assign(new Error('Service Unavailable'), { response: { status: 503 } });
  assert.equal(classifyAccountLookupError(err), 'HORIZON_UNAVAILABLE');
});

test('no account object and no error means unfunded', () => {
  const result = classifyTrustlinePreflight({
    assetCode: 'USDC',
    assetIssuer: USDC_ISSUER,
    account: null,
  });
  assert.equal(result.code, 'ACCOUNT_NOT_FOUND');
});

test('asset codes normalize before comparing', () => {
  const result = classifyTrustlinePreflight({
    assetCode: 'usdc',
    assetIssuer: USDC_ISSUER,
    account: fundedWithUsdc,
  });
  assert.equal(result.ok, true);
});

test('trustline copy names the asset and the network', () => {
  const message = trustlinePreflightMessage('MISSING_TRUSTLINE', 'USDC', 'testnet');
  assert.match(message, /USDC/);
  assert.match(message, /testnet/);
  assert.match(message, /XLM invoice/);
});
