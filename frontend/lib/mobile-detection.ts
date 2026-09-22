export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export type MobileOs = 'ios' | 'android' | 'other' | null;

export interface DeviceContext {
  isMobile: boolean;
  deviceType: DeviceType;
  os: MobileOs;
  isTouchDevice: boolean;
  canInstallExtensions: boolean;
  supportsFreighterExtension: boolean;
  supportsSep0007: boolean;
}

export interface Sep0007PayParams {
  destination: string;
  amount?: string;
  assetCode?: string;
  assetIssuer?: string;
  memo?: string;
  memoType?: string;
  networkPassphrase?: string;
  /**
   * Same-origin page the wallet should return the payer to after signing,
   * emitted as SEP-0007 `callback=url:<value>`. Build it with
   * `buildPayCallbackUrl` — never from a caller-supplied return_url.
   */
  callback?: string;
}

const IOS_REGEX = /iPhone|iPad|iPod/i;
const ANDROID_REGEX = /Android/i;
const MOBILE_GENERIC_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
const TABLET_REGEX = /iPad|tablet|(android(?!.*mobile))/i;

/**
 * Detect device characteristics, operating system, and extension capabilities.
 *
 * @param userAgent - Optional user agent string. Defaults to navigator.userAgent when in browser.
 * @param maxTouchPoints - Optional touch points count. Defaults to navigator.maxTouchPoints when in browser.
 * @returns DeviceContext representing the execution environment.
 */
export function detectDevice(userAgent?: string, maxTouchPoints?: number): DeviceContext {
  const ua =
    userAgent !== undefined
      ? userAgent
      : typeof navigator !== 'undefined'
      ? navigator.userAgent || ''
      : '';

  const touchPoints =
    maxTouchPoints !== undefined
      ? maxTouchPoints
      : typeof navigator !== 'undefined'
      ? navigator.maxTouchPoints || 0
      : 0;

  const isTouchDevice = touchPoints > 0;
  const isIpadMacIntel = !IOS_REGEX.test(ua) && /Macintosh/i.test(ua) && touchPoints > 1;

  let os: MobileOs = null;
  if (IOS_REGEX.test(ua) || isIpadMacIntel) {
    os = 'ios';
  } else if (ANDROID_REGEX.test(ua)) {
    os = 'android';
  } else if (MOBILE_GENERIC_REGEX.test(ua)) {
    os = 'other';
  }

  let deviceType: DeviceType = 'desktop';
  if (TABLET_REGEX.test(ua) || isIpadMacIntel) {
    deviceType = 'tablet';
  } else if (os !== null || MOBILE_GENERIC_REGEX.test(ua)) {
    deviceType = 'mobile';
  }

  const isMobile = deviceType === 'mobile' || deviceType === 'tablet';
  const canInstallExtensions = !isMobile;
  const supportsFreighterExtension = !isMobile;

  return {
    isMobile,
    deviceType,
    os,
    isTouchDevice,
    canInstallExtensions,
    supportsFreighterExtension,
    supportsSep0007: true,
  };
}

/**
 * Determine whether the client is running on a mobile browser.
 *
 * @param userAgent - Optional user agent string.
 * @returns True if running on mobile or tablet browser.
 */
export function isMobileBrowser(userAgent?: string): boolean {
  return detectDevice(userAgent).isMobile;
}

/**
 * Return a human-readable name for the mobile platform.
 *
 * @param userAgent - Optional user agent string.
 * @returns Platform display string.
 */
export function getMobilePlatformName(userAgent?: string): string {
  const { os, deviceType } = detectDevice(userAgent);
  if (os === 'ios') {
    return deviceType === 'tablet' ? 'iPadOS' : 'iOS';
  }
  if (os === 'android') {
    return 'Android';
  }
  if (os === 'other') {
    return 'Mobile';
  }
  return 'Desktop';
}

/**
 * Construct a standards-compliant SEP-0007 payment URI (web+stellar:pay).
 *
 * @param params - Parameters required to build the SEP-0007 URI.
 * @returns Fully formatted web+stellar:pay URI string.
 */
export function buildSep0007PayUri(params: Sep0007PayParams): string {
  if (!params || !params.destination) {
    throw new Error('Destination public key is required for SEP-0007 payment URI');
  }

  const searchParams = new URLSearchParams();
  searchParams.set('destination', params.destination.trim());

  if (params.amount && params.amount.trim() !== '') {
    searchParams.set('amount', params.amount.trim());
  }

  const assetCode = params.assetCode ? params.assetCode.trim() : '';
  if (assetCode && assetCode.toUpperCase() !== 'XLM') {
    searchParams.set('asset_code', assetCode);
    if (params.assetIssuer && params.assetIssuer.trim() !== '') {
      searchParams.set('asset_issuer', params.assetIssuer.trim());
    }
  }

  if (params.memo && params.memo.trim() !== '') {
    searchParams.set('memo', params.memo.trim());
    searchParams.set('memo_type', params.memoType ? params.memoType.trim() : 'MEMO_TEXT');
  }

  if (params.networkPassphrase && params.networkPassphrase.trim() !== '') {
    searchParams.set('network_passphrase', params.networkPassphrase.trim());
  }

  if (params.callback && params.callback.trim() !== '') {
    searchParams.set('callback', `url:${params.callback.trim()}`);
  }

  return `web+stellar:pay?${searchParams.toString()}`;
}
