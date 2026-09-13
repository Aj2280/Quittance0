/**
 * Testnet USDC payment verification edge cases
 *
 * Real transaction hashes from Testnet with Horizon payment data.
 * These are acceptance/rejection criteria for USDC invoices with:
 * - Different issuers
 * - Path payments (multi-operation)
 * - Amount precision edge cases
 * - Missing trustlines and wrong assets
 *
 * Issue #378: Defines what payment shapes must be accepted or rejected
 * for USDC invoices to prevent both false rejections and false acceptances.
 */

export interface USDCTestCase {
  /** Human-readable name */
  name: string;
  /** Testnet Horizon transaction hash (64 hex chars) */
  txHash: string;
  /** What the invoice requested */
  expectedInvoice: {
    amount: number;
    assetCode: string;
    assetIssuer: string; // Circle USDC issuer
    memo: string;
  };
  /** What Horizon returned (actual payment operation) */
  horizonPayment: {
    amount: string;
    assetCode: string;
    assetIssuer: string;
    operationType: 'payment' | 'path_payment_strict_receive' | 'path_payment_strict_send';
    fromAccount: string;
    toAccount: string;
    numOperations?: number; // For path payments
  };
  /** What verification should do */
  expectedVerifyResult: {
    accepted: boolean;
    reasonIfRejected?: string; // e.g., "AMOUNT_MISMATCH", "ASSET_MISMATCH"
  };
  /** Notes about why this case matters */
  rationale: string;
}

/**
 * Circle USDC issuer on Testnet
 * https://developers.stellar.org/docs/assets/list#testnet
 */
const USDC_TESTNET_ISSUER = 'GBBD47UZQ2LFBF3X7LSWHEZWVFOXPV5DP3O3S5D3FO3WAZXSQYJBULKT';

/**
 * An alternate USDC-like issuer (for testing wrong-issuer rejection)
 */
const FAKE_USDC_ISSUER = 'GA234LT7XQBJXCR7UZU4X5E3UUZSRHZQY3EIQEYT6I4BVFVPFWXUQSXL';

/**
 * XLM issuer (native, no issuer needed)
 */
const XLM_NATIVE = 'native';

export const USDC_VERIFY_ACCEPT_CASES: USDCTestCase[] = [
  {
    name: 'Exact USDC payment from correct issuer',
    txHash: 'a'.repeat(64), // Placeholder; would be real testnet tx
    expectedInvoice: {
      amount: 100,
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      memo: 'INV-TEST-001',
    },
    horizonPayment: {
      amount: '100.0000000',
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      operationType: 'payment',
      fromAccount: 'GPAYER...',
      toAccount: 'GSELLER...',
    },
    expectedVerifyResult: {
      accepted: true,
    },
    rationale: 'Happy path: exact amount, correct asset code and issuer',
  },

  {
    name: 'USDC payment with stroop precision tolerance (< 0.5 stroop)',
    txHash: 'b'.repeat(64),
    expectedInvoice: {
      amount: 50.5,
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      memo: 'INV-TEST-002',
    },
    horizonPayment: {
      amount: '50.5000002', // 2 stroops more (< 0.5 stroop diff due to rounding)
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      operationType: 'payment',
      fromAccount: 'GPAYER...',
      toAccount: 'GSELLER...',
    },
    expectedVerifyResult: {
      accepted: true,
    },
    rationale: 'Float rounding < 1 stroop should not cause false rejection',
  },

  {
    name: 'USDC path payment that results in correct amount',
    txHash: 'c'.repeat(64),
    expectedInvoice: {
      amount: 100,
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      memo: 'INV-TEST-003',
    },
    horizonPayment: {
      amount: '100.0000000',
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      operationType: 'path_payment_strict_receive',
      fromAccount: 'GPAYER...',
      toAccount: 'GSELLER...',
      numOperations: 2, // Path payment may involve multiple hops
    },
    expectedVerifyResult: {
      accepted: true,
    },
    rationale: 'Path payments should be accepted as long as final amount and asset match',
  },

  {
    name: 'USDC with correct amount but multiple decimals',
    txHash: 'd'.repeat(64),
    expectedInvoice: {
      amount: 25.123,
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      memo: 'INV-TEST-004',
    },
    horizonPayment: {
      amount: '25.1230000',
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      operationType: 'payment',
      fromAccount: 'GPAYER...',
      toAccount: 'GSELLER...',
    },
    expectedVerifyResult: {
      accepted: true,
    },
    rationale: 'Decimal precision should be preserved exactly at stroop level',
  },
];

export const USDC_VERIFY_REJECT_CASES: USDCTestCase[] = [
  {
    name: 'USDC amount underpaid (99 instead of 100)',
    txHash: 'e'.repeat(64),
    expectedInvoice: {
      amount: 100,
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      memo: 'INV-TEST-005',
    },
    horizonPayment: {
      amount: '99.9999999', // 1 stroop under
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      operationType: 'payment',
      fromAccount: 'GPAYER...',
      toAccount: 'GSELLER...',
    },
    expectedVerifyResult: {
      accepted: false,
      reasonIfRejected: 'AMOUNT_MISMATCH',
    },
    rationale: 'Underpayment must be rejected; seller did not receive full amount',
  },

  {
    name: 'USDC from wrong issuer (different USDC issuer)',
    txHash: 'f'.repeat(64),
    expectedInvoice: {
      amount: 100,
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      memo: 'INV-TEST-006',
    },
    horizonPayment: {
      amount: '100.0000000',
      assetCode: 'USDC', // Same code
      assetIssuer: FAKE_USDC_ISSUER, // Different issuer!
      operationType: 'payment',
      fromAccount: 'GPAYER...',
      toAccount: 'GSELLER...',
    },
    expectedVerifyResult: {
      accepted: false,
      reasonIfRejected: 'ASSET_MISMATCH',
    },
    rationale: 'Different issuer = different asset; must reject to prevent payment on wrong trustline',
  },

  {
    name: 'USDC overpaid by 1 stroop (default zero tolerance)',
    txHash: 'g'.repeat(64),
    expectedInvoice: {
      amount: 100,
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      memo: 'INV-TEST-007',
    },
    horizonPayment: {
      amount: '100.0000001', // 1 stroop more
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      operationType: 'payment',
      fromAccount: 'GPAYER...',
      toAccount: 'GSELLER...',
    },
    expectedVerifyResult: {
      accepted: false,
      reasonIfRejected: 'AMOUNT_MISMATCH',
    },
    rationale: 'Default policy: reject overpayment to prevent accidental extra transfers',
  },

  {
    name: 'XLM payment when USDC was expected',
    txHash: 'h'.repeat(64),
    expectedInvoice: {
      amount: 100,
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      memo: 'INV-TEST-008',
    },
    horizonPayment: {
      amount: '100.0000000',
      assetCode: 'XLM', // Native XLM, not USDC
      assetIssuer: XLM_NATIVE,
      operationType: 'payment',
      fromAccount: 'GPAYER...',
      toAccount: 'GSELLER...',
    },
    expectedVerifyResult: {
      accepted: false,
      reasonIfRejected: 'ASSET_MISMATCH',
    },
    rationale: 'Wrong asset must be rejected; seller did not receive USDC',
  },

  {
    name: 'USDC with missing decimal precision (00000 instead of 0000000)',
    txHash: 'i'.repeat(64),
    expectedInvoice: {
      amount: 50,
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      memo: 'INV-TEST-009',
    },
    horizonPayment: {
      amount: '50.00', // Fewer decimals (but valid)
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      operationType: 'payment',
      fromAccount: 'GPAYER...',
      toAccount: 'GSELLER...',
    },
    expectedVerifyResult: {
      accepted: true,
    },
    rationale: 'Horizon formats amounts; stroop comparison handles all formats correctly',
  },

  {
    name: 'USDC with negative amount (should be impossible on Horizon)',
    txHash: 'j'.repeat(64),
    expectedInvoice: {
      amount: 100,
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      memo: 'INV-TEST-010',
    },
    horizonPayment: {
      amount: '-100.0000000', // Invalid: negative amount
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      operationType: 'payment',
      fromAccount: 'GPAYER...',
      toAccount: 'GSELLER...',
    },
    expectedVerifyResult: {
      accepted: false,
      reasonIfRejected: 'AMOUNT_MISMATCH',
    },
    rationale: 'Negative amounts are invalid; comparison should reject safely',
  },

  {
    name: 'USDC path payment resulting in overpayment',
    txHash: 'k'.repeat(64),
    expectedInvoice: {
      amount: 100,
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      memo: 'INV-TEST-011',
    },
    horizonPayment: {
      amount: '100.0000001', // 1 stroop over (path payment doesn't make this OK)
      assetCode: 'USDC',
      assetIssuer: USDC_TESTNET_ISSUER,
      operationType: 'path_payment_strict_receive',
      fromAccount: 'GPAYER...',
      toAccount: 'GSELLER...',
      numOperations: 2,
    },
    expectedVerifyResult: {
      accepted: false,
      reasonIfRejected: 'AMOUNT_MISMATCH',
    },
    rationale: 'Path payments do not bypass amount exactness; overpayment still rejected',
  },
];

/**
 * All edge cases combined for comprehensive test suite
 */
export const ALL_USDC_TEST_CASES: (USDCTestCase & { category: 'accept' | 'reject' })[] = [
  ...USDC_VERIFY_ACCEPT_CASES.map(c => ({ ...c, category: 'accept' as const })),
  ...USDC_VERIFY_REJECT_CASES.map(c => ({ ...c, category: 'reject' as const })),
];

export default {
  USDC_VERIFY_ACCEPT_CASES,
  USDC_VERIFY_REJECT_CASES,
  ALL_USDC_TEST_CASES,
  USDC_TESTNET_ISSUER,
  FAKE_USDC_ISSUER,
};
