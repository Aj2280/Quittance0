import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  detectDevice,
  isMobileBrowser,
  getMobilePlatformName,
  buildSep0007PayUri,
} from '../frontend/lib/mobile-detection.js';
import { MOBILE_FALLBACK_COPY } from '../frontend/lib/mobile-fallback-copy.js';

describe('Freighter Mobile Feasibility Integration Vectors', () => {
  it('detects desktop vs mobile platforms accurately', () => {
    const desktopChrome =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
    const mobileIphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
    const mobileAndroid =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.90 Mobile Safari/537.36';

    const desktopResult = detectDevice(desktopChrome, 0);
    assert.equal(desktopResult.isMobile, false);
    assert.equal(desktopResult.supportsFreighterExtension, true);

    const iosResult = detectDevice(mobileIphone, 5);
    assert.equal(iosResult.isMobile, true);
    assert.equal(iosResult.os, 'ios');
    assert.equal(iosResult.supportsFreighterExtension, false);

    const androidResult = detectDevice(mobileAndroid, 5);
    assert.equal(androidResult.isMobile, true);
    assert.equal(androidResult.os, 'android');
    assert.equal(androidResult.supportsFreighterExtension, false);
  });

  it('builds standard-compliant SEP-0007 payment URIs for mobile wallets', () => {
    const uri = buildSep0007PayUri({
      destination: 'GA2C5RFPE6GCKMY3US5PAB6UZLKIGAHWKXX2G2ZVGSRYSQH5ULWBSXR7',
      amount: '42.0000000',
      assetCode: 'XLM',
      memo: 'Q-FEASIBILITY-TEST',
    });

    const parsed = new URL(uri);
    assert.equal(parsed.protocol, 'web+stellar:');
    assert.equal(parsed.pathname, 'pay');
    assert.equal(
      parsed.searchParams.get('destination'),
      'GA2C5RFPE6GCKMY3US5PAB6UZLKIGAHWKXX2G2ZVGSRYSQH5ULWBSXR7'
    );
    assert.equal(parsed.searchParams.get('amount'), '42.0000000');
    assert.equal(parsed.searchParams.get('memo'), 'Q-FEASIBILITY-TEST');
    assert.equal(parsed.searchParams.get('memo_type'), 'MEMO_TEXT');
  });

  it('guarantees fallback copy provides clear guidance without emojis or auth requirements', () => {
    assert.equal(typeof MOBILE_FALLBACK_COPY.badge, 'string');
    assert.equal(typeof MOBILE_FALLBACK_COPY.headline, 'string');
    assert.match(MOBILE_FALLBACK_COPY.noAuthNote, /No account or Google login required/i);

    const { mobileWallet, manualTransfer, desktopHandoff } = MOBILE_FALLBACK_COPY.options;
    assert.ok(mobileWallet.title && mobileWallet.description && mobileWallet.cta);
    assert.ok(manualTransfer.title && manualTransfer.description && manualTransfer.memoWarning);
    assert.ok(desktopHandoff.title && desktopHandoff.description && desktopHandoff.cta);

    const emojiRegex = /\p{Extended_Pictographic}/u;
    assert.equal(emojiRegex.test(JSON.stringify(MOBILE_FALLBACK_COPY)), false);
  });

  it('validates documentation artifacts exist and cover required matrices', async () => {
    const feasibilityDoc = await readFile(
      resolve(process.cwd(), 'docs/MOBILE_PAY_FEASIBILITY.md'),
      'utf8'
    );
    const demoScriptDoc = await readFile(
      resolve(process.cwd(), 'docs/MOBILE_DEMO_SCRIPT.md'),
      'utf8'
    );

    assert.match(feasibilityDoc, /# Freighter Mobile Pay Feasibility Analysis/);
    assert.match(feasibilityDoc, /Device and Browser Matrix/);
    assert.match(feasibilityDoc, /Safari/);
    assert.match(feasibilityDoc, /Chrome/);
    assert.match(feasibilityDoc, /In-App WebViews/);
    assert.match(feasibilityDoc, /Deep-Link Protocol Evaluation/);
    assert.match(feasibilityDoc, /Non-Custodial Fallback Architecture/);
    assert.match(feasibilityDoc, /SEP-0007/);
    assert.match(feasibilityDoc, /Unsupported Scenarios Catalog/);

    assert.match(demoScriptDoc, /# Mobile Payment Feasibility Demo Script/);
    assert.match(demoScriptDoc, /Demonstration Steps/);
    assert.match(demoScriptDoc, /Verification Checklist/);
  });
});
