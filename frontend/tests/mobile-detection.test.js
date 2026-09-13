const test = require('node:test');
const assert = require('node:assert/strict');
const {
  detectDevice,
  isMobileBrowser,
  getMobilePlatformName,
  buildSep0007PayUri,
} = require('../lib/mobile-detection.js');

const USER_AGENTS = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1',
  ipadSafari:
    'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  androidPhone:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.90 Mobile Safari/537.36',
  androidTablet:
    'Mozilla/5.0 (Linux; Android 14; SM-X910) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.90 Safari/537.36',
  desktopMacChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  desktopWindowsEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
  desktopLinuxFirefox:
    'Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0',
};

test('detectDevice detects iPhone browsers as mobile iOS with no extension support', () => {
  const result = detectDevice(USER_AGENTS.iphoneSafari, 5);
  assert.equal(result.isMobile, true);
  assert.equal(result.deviceType, 'mobile');
  assert.equal(result.os, 'ios');
  assert.equal(result.canInstallExtensions, false);
  assert.equal(result.supportsFreighterExtension, false);
});

test('detectDevice detects Android phone browsers as mobile Android with no extension support', () => {
  const result = detectDevice(USER_AGENTS.androidPhone, 5);
  assert.equal(result.isMobile, true);
  assert.equal(result.deviceType, 'mobile');
  assert.equal(result.os, 'android');
  assert.equal(result.canInstallExtensions, false);
  assert.equal(result.supportsFreighterExtension, false);
});

test('detectDevice detects iPadOS with Mac Intel user agent and touch points', () => {
  const result = detectDevice(USER_AGENTS.ipadDesktopMode, 5);
  assert.equal(result.isMobile, true);
  assert.equal(result.deviceType, 'tablet');
  assert.equal(result.os, 'ios');
  assert.equal(result.supportsFreighterExtension, false);
});

test('detectDevice detects Android tablet correctly', () => {
  const result = detectDevice(USER_AGENTS.androidTablet, 5);
  assert.equal(result.isMobile, true);
  assert.equal(result.deviceType, 'tablet');
  assert.equal(result.os, 'android');
});

test('detectDevice detects desktop environments with extension support', () => {
  const mac = detectDevice(USER_AGENTS.desktopMacChrome, 0);
  assert.equal(mac.isMobile, false);
  assert.equal(mac.deviceType, 'desktop');
  assert.equal(mac.os, null);
  assert.equal(mac.supportsFreighterExtension, true);

  const win = detectDevice(USER_AGENTS.desktopWindowsEdge, 0);
  assert.equal(win.isMobile, false);
  assert.equal(win.supportsFreighterExtension, true);

  const linux = detectDevice(USER_AGENTS.desktopLinuxFirefox, 0);
  assert.equal(linux.isMobile, false);
  assert.equal(linux.supportsFreighterExtension, true);
});

test('isMobileBrowser returns accurate boolean', () => {
  assert.equal(isMobileBrowser(USER_AGENTS.iphoneChrome), true);
  assert.equal(isMobileBrowser(USER_AGENTS.androidPhone), true);
  assert.equal(isMobileBrowser(USER_AGENTS.desktopMacChrome), false);
});

test('getMobilePlatformName returns standard labels', () => {
  assert.equal(getMobilePlatformName(USER_AGENTS.iphoneSafari), 'iOS');
  assert.equal(getMobilePlatformName(USER_AGENTS.ipadSafari), 'iPadOS');
  assert.equal(getMobilePlatformName(USER_AGENTS.androidPhone), 'Android');
  assert.equal(getMobilePlatformName(USER_AGENTS.desktopMacChrome), 'Desktop');
});

test('buildSep0007PayUri formats native XLM payment URI correctly', () => {
  const uri = buildSep0007PayUri({
    destination: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    amount: '12.5000000',
    assetCode: 'XLM',
    memo: 'Q-381-TEST',
  });

  assert.equal(
    uri,
    'web+stellar:pay?destination=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5&amount=12.5000000&memo=Q-381-TEST&memo_type=MEMO_TEXT'
  );
});

test('buildSep0007PayUri formats issued asset payment URI with issuer', () => {
  const uri = buildSep0007PayUri({
    destination: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    amount: '100.0000000',
    assetCode: 'USDC',
    assetIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    memo: 'Q-USDC-999',
  });

  assert.equal(
    uri,
    'web+stellar:pay?destination=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5&amount=100.0000000&asset_code=USDC&asset_issuer=GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5&memo=Q-USDC-999&memo_type=MEMO_TEXT'
  );
});

test('buildSep0007PayUri includes network passphrase when provided', () => {
  const uri = buildSep0007PayUri({
    destination: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    amount: '5.0000000',
    networkPassphrase: 'Test SDF Network ; September 2015',
  });

  assert.match(uri, /network_passphrase=Test\+SDF\+Network/);
});

test('buildSep0007PayUri throws when destination is missing', () => {
  assert.throws(
    () => buildSep0007PayUri({ destination: '' }),
    /Destination public key is required/
  );
});
