'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MOBILE_FALLBACK_COPY } = require('../lib/mobile-fallback-copy.js');

test('MOBILE_FALLBACK_COPY is frozen against mutation', () => {
  assert.equal(Object.isFrozen(MOBILE_FALLBACK_COPY), true);
  assert.throws(() => {
    MOBILE_FALLBACK_COPY.badge = 'mutated';
  }, TypeError);
});

test('MOBILE_FALLBACK_COPY contains all required UI sections and clear guidance', () => {
  assert.equal(typeof MOBILE_FALLBACK_COPY.badge, 'string');
  assert.equal(MOBILE_FALLBACK_COPY.badge, 'Mobile Device Detected');

  assert.equal(typeof MOBILE_FALLBACK_COPY.headline, 'string');
  assert.match(MOBILE_FALLBACK_COPY.headline, /desktop extension/i);

  assert.equal(typeof MOBILE_FALLBACK_COPY.description, 'string');
  assert.match(MOBILE_FALLBACK_COPY.description, /cannot run the Freighter extension/i);

  assert.equal(typeof MOBILE_FALLBACK_COPY.noAuthNote, 'string');
  assert.match(MOBILE_FALLBACK_COPY.noAuthNote, /No account or Google login required/i);
});

test('MOBILE_FALLBACK_COPY provides three distinct fallback paths', () => {
  const { mobileWallet, manualTransfer, desktopHandoff } = MOBILE_FALLBACK_COPY.options;

  assert.equal(mobileWallet.title, 'Pay with Mobile Wallet');
  assert.match(mobileWallet.description, /SEP-0007/);
  assert.equal(mobileWallet.cta, 'Open in Stellar Wallet');

  assert.equal(manualTransfer.title, 'Copy Payment Details');
  assert.match(manualTransfer.description, /Transfer the exact amount/);
  assert.match(manualTransfer.memoWarning, /Always include the exact memo/);

  assert.equal(desktopHandoff.title, 'Open on Desktop');
  assert.match(desktopHandoff.description, /desktop browser with Freighter installed/);
  assert.equal(desktopHandoff.cta, 'Copy Payment Link');
});

test('MOBILE_FALLBACK_COPY contains honest unsupported capabilities notice', () => {
  assert.match(
    MOBILE_FALLBACK_COPY.unsupportedNotice,
    /Freighter does not currently support mobile apps, mobile in-app browsers, or custom deep-link transaction signing/
  );
});

test('MOBILE_FALLBACK_COPY does not contain any emojis', () => {
  const emojiRegex = /\p{Extended_Pictographic}/u;
  const jsonStr = JSON.stringify(MOBILE_FALLBACK_COPY);
  assert.equal(emojiRegex.test(jsonStr), false);
});
