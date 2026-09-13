/**
 * Mobile device and browser detection for payment fallback routing
 */

export interface DeviceContext {
  isMobile: boolean;
  isTablet: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isInAppBrowser: boolean;
  browser: 'freighter' | 'safari' | 'chrome' | 'firefox' | 'unknown';
  canCopy: boolean;
  canOpenDeepLink: boolean;
}

/**
 * Detect if code is running in browser and get user agent
 */
function getUserAgent(): string {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent || '';
}

/**
 * Detect if running in various mobile wallet in-app browsers
 */
function detectInAppBrowser(): boolean {
  const ua = getUserAgent().toLowerCase();
  
  // Common in-app browser indicators
  const patterns = [
    /freighter/i,         // Freighter mobile (rare)
    /lobstr/i,            // LOBSTR in-app
    /xbull/i,             // xBull in-app
    /stellar/i,           // Generic Stellar app
    /metamask/i,          // MetaMask (for reference)
    /webview/i,           // Generic WebView
    /wv\)/i,              // Android WebView
    /inappbrowser/i,      // Generic in-app browser
  ];
  
  return patterns.some(pattern => pattern.test(ua));
}

/**
 * Detect device type and browser
 */
export function detectDeviceContext(): DeviceContext {
  const ua = getUserAgent();
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isMobile = isIOS || (isAndroid && !/Tablet/.test(ua));
  const isTablet = isAndroid && /Tablet/.test(ua) || /iPad/.test(ua);
  const isInAppBrowser = detectInAppBrowser();
  
  // Browser detection
  let browser: DeviceContext['browser'] = 'unknown';
  if (/Freighter/.test(ua)) browser = 'freighter';
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'safari';
  else if (/Chrome/.test(ua)) browser = 'chrome';
  else if (/Firefox/.test(ua)) browser = 'firefox';
  
  // Check clipboard API availability
  const canCopy = typeof navigator !== 'undefined' && 
                 typeof navigator.clipboard?.writeText === 'function';
  
  // Can we open deep links? (should work on mobile)
  const canOpenDeepLink = isMobile || isTablet;
  
  return {
    isMobile,
    isTablet,
    isIOS,
    isAndroid,
    isInAppBrowser,
    browser,
    canCopy,
    canOpenDeepLink,
  };
}

/**
 * Build a deep link URI for various mobile wallets
 */
export interface DeepLinkOptions {
  destination: string;
  amount?: string;
  memo?: string;
  assetCode?: string;
  assetIssuer?: string;
}

export function buildFreighterDeepLink(options: DeepLinkOptions): string {
  // Freighter mobile deep link format (if supported in future)
  // For now, returns empty string as Freighter doesn't publicly support deep links
  return '';
}

export function buildLOBSTRDeepLink(options: DeepLinkOptions): string {
  const params = new URLSearchParams();
  params.append('destination_address', options.destination);
  if (options.amount) params.append('amount', options.amount);
  if (options.memo) params.append('memo', options.memo);
  if (options.assetCode && options.assetCode !== 'XLM') {
    params.append('asset_code', options.assetCode);
  }
  if (options.assetIssuer && options.assetCode !== 'XLM') {
    params.append('asset_issuer', options.assetIssuer);
  }
  
  return `lobstr://pay?${params.toString()}`;
}

export function buildXBullDeepLink(options: DeepLinkOptions): string {
  const params = new URLSearchParams();
  params.append('to', options.destination);
  if (options.amount) params.append('amount', options.amount);
  if (options.memo) params.append('memo', options.memo);
  if (options.assetCode && options.assetCode !== 'XLM') {
    params.append('asset', options.assetCode);
  }
  if (options.assetIssuer && options.assetCode !== 'XLM') {
    params.append('issuer', options.assetIssuer);
  }
  
  return `xbull://pay?${params.toString()}`;
}

/**
 * Attempt to open a deep link, with fallback
 */
export async function attemptDeepLink(
  deepLink: string,
  fallbackFn: () => void,
  timeoutMs: number = 1500
): Promise<void> {
  if (!deepLink) {
    fallbackFn();
    return;
  }
  
  // Store current document title to detect if app opened
  const originalTitle = typeof document !== 'undefined' ? document.title : '';
  let titleChangeDetected = false;
  
  // Listen for title changes (indicates app might have opened)
  const titleWatcher = typeof document !== 'undefined' 
    ? () => {
        if (document.title !== originalTitle) {
          titleChangeDetected = true;
        }
      }
    : null;
  
  if (titleWatcher) {
    document.addEventListener('visibilitychange', titleWatcher);
  }
  
  // Create a temporary link and click it
  try {
    const link = typeof document !== 'undefined' ? document.createElement('a') : null;
    if (!link) {
      fallbackFn();
      return;
    }
    
    link.href = deepLink;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Wait to see if the app opened
    await new Promise(resolve => setTimeout(resolve, timeoutMs));
    
    // If we're still here and title didn't change, app probably didn't open
    if (!titleChangeDetected) {
      fallbackFn();
    }
  } catch (error) {
    console.error('Deep link attempt failed:', error);
    fallbackFn();
  } finally {
    if (titleWatcher) {
      document.removeEventListener('visibilitychange', titleWatcher);
    }
  }
}

/**
 * Available mobile wallet deep link options
 */
export const MOBILE_WALLETS = [
  {
    id: 'lobstr',
    name: 'LOBSTR',
    buildLink: buildLOBSTRDeepLink,
    platforms: ['ios', 'android'] as const,
  },
  {
    id: 'xbull',
    name: 'xBull',
    buildLink: buildXBullDeepLink,
    platforms: ['ios', 'android'] as const,
  },
] as const;

/**
 * Get recommended wallets for current device
 */
export function getRecommendedMobileWallets(platform: 'ios' | 'android'): typeof MOBILE_WALLETS {
  return MOBILE_WALLETS.filter(wallet => wallet.platforms.includes(platform));
}

export default {
  detectDeviceContext,
  buildLOBSTRDeepLink,
  buildXBullDeepLink,
  attemptDeepLink,
  MOBILE_WALLETS,
  getRecommendedMobileWallets,
};
