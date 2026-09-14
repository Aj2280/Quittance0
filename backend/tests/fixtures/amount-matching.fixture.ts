/**
 * Test fixtures for amount matching and underpayment/overpayment rejection testing.
 * Covers XLM (native) and USDC (credit_alphanum4) assets across dust, exact, under, and over scenarios.
 */

export interface AmountMatchingFixtureCase {
  id: string;
  name: string;
  expectedAmount: string | number;
  actualAmount: string;
  assetCode: string;
  assetType: 'native' | 'credit_alphanum4';
  assetIssuer?: string;
  scenario: 'exact' | 'under' | 'dust' | 'over' | 'invalid';
  expectedOk: boolean;
  expectedCode?: string;
  description: string;
}

export const CIRCLE_USDC_TESTNET_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

export const AMOUNT_MATCHING_FIXTURES: AmountMatchingFixtureCase[] = [
  // --- Exact Match Scenarios ---
  {
    id: 'xlm-exact-integer',
    name: 'XLM exact integer amount matches',
    expectedAmount: 100,
    actualAmount: '100.0000000',
    assetCode: 'XLM',
    assetType: 'native',
    scenario: 'exact',
    expectedOk: true,
    description: 'Exact integer amount 100 paid as 100.0000000 stroops must verify successfully',
  },
  {
    id: 'xlm-exact-decimal',
    name: 'XLM exact decimal amount matches',
    expectedAmount: '25.5000000',
    actualAmount: '25.5000000',
    assetCode: 'XLM',
    assetType: 'native',
    scenario: 'exact',
    expectedOk: true,
    description: 'Exact decimal amount 25.5000000 paid identically must verify successfully',
  },
  {
    id: 'usdc-exact',
    name: 'USDC exact amount matches',
    expectedAmount: '50.0000000',
    actualAmount: '50.0000000',
    assetCode: 'USDC',
    assetType: 'credit_alphanum4',
    assetIssuer: CIRCLE_USDC_TESTNET_ISSUER,
    scenario: 'exact',
    expectedOk: true,
    description: 'Exact credit USDC amount must verify successfully',
  },

  // --- Dust Payment Scenarios ---
  {
    id: 'xlm-dust-payment',
    name: 'XLM dust payment (1 stroop) on 100 XLM invoice is rejected',
    expectedAmount: 100,
    actualAmount: '0.0000001',
    assetCode: 'XLM',
    assetType: 'native',
    scenario: 'dust',
    expectedOk: false,
    expectedCode: 'AMOUNT_MISMATCH',
    description: 'Dust payment of 0.0000001 XLM on a 100 XLM invoice must be rejected',
  },
  {
    id: 'usdc-dust-payment',
    name: 'USDC dust payment (1 stroop) on 50 USDC invoice is rejected',
    expectedAmount: '50.0000000',
    actualAmount: '0.0000001',
    assetCode: 'USDC',
    assetType: 'credit_alphanum4',
    assetIssuer: CIRCLE_USDC_TESTNET_ISSUER,
    scenario: 'dust',
    expectedOk: false,
    expectedCode: 'AMOUNT_MISMATCH',
    description: 'Dust payment of 0.0000001 USDC on a 50 USDC invoice must be rejected',
  },

  // --- Underpayment Scenarios ---
  {
    id: 'xlm-underpay-1-stroop',
    name: 'XLM underpayment by 1 stroop is rejected',
    expectedAmount: '100.0000000',
    actualAmount: '99.9999999',
    assetCode: 'XLM',
    assetType: 'native',
    scenario: 'under',
    expectedOk: false,
    expectedCode: 'AMOUNT_MISMATCH',
    description: 'Sending 99.9999999 on a 100 XLM invoice is an underpayment and must fail',
  },
  {
    id: 'xlm-underpay-partial',
    name: 'XLM partial underpayment (50%) is rejected',
    expectedAmount: '100.0000000',
    actualAmount: '50.0000000',
    assetCode: 'XLM',
    assetType: 'native',
    scenario: 'under',
    expectedOk: false,
    expectedCode: 'AMOUNT_MISMATCH',
    description: 'Paying 50 XLM on a 100 XLM invoice must be rejected with AMOUNT_MISMATCH',
  },
  {
    id: 'usdc-underpay-cent',
    name: 'USDC underpayment by 1 cent is rejected',
    expectedAmount: '20.0000000',
    actualAmount: '19.9900000',
    assetCode: 'USDC',
    assetType: 'credit_alphanum4',
    assetIssuer: CIRCLE_USDC_TESTNET_ISSUER,
    scenario: 'under',
    expectedOk: false,
    expectedCode: 'AMOUNT_MISMATCH',
    description: 'Paying 19.99 USDC on a 20 USDC invoice must be rejected with AMOUNT_MISMATCH',
  },

  // --- Overpayment Scenarios ---
  {
    id: 'xlm-overpay-1-stroop',
    name: 'XLM overpayment by 1 stroop is rejected per policy',
    expectedAmount: '100.0000000',
    actualAmount: '100.0000001',
    assetCode: 'XLM',
    assetType: 'native',
    scenario: 'over',
    expectedOk: false,
    expectedCode: 'AMOUNT_MISMATCH',
    description: 'Sending 100.0000001 on a 100 XLM invoice is an overpayment and must be rejected',
  },
  {
    id: 'xlm-overpay-large',
    name: 'XLM large overpayment is rejected per policy',
    expectedAmount: '100.0000000',
    actualAmount: '150.0000000',
    assetCode: 'XLM',
    assetType: 'native',
    scenario: 'over',
    expectedOk: false,
    expectedCode: 'AMOUNT_MISMATCH',
    description: 'Paying 150 XLM on a 100 XLM invoice must be rejected per overpayment policy',
  },
  {
    id: 'usdc-overpay',
    name: 'USDC overpayment is rejected per policy',
    expectedAmount: '20.0000000',
    actualAmount: '25.0000000',
    assetCode: 'USDC',
    assetType: 'credit_alphanum4',
    assetIssuer: CIRCLE_USDC_TESTNET_ISSUER,
    scenario: 'over',
    expectedOk: false,
    expectedCode: 'AMOUNT_MISMATCH',
    description: 'Paying 25 USDC on a 20 USDC invoice must be rejected with AMOUNT_MISMATCH',
  },

  // --- Zero and Invalid Amounts ---
  {
    id: 'zero-amount',
    name: 'Zero payment amount is rejected',
    expectedAmount: '10.0000000',
    actualAmount: '0.0000000',
    assetCode: 'XLM',
    assetType: 'native',
    scenario: 'invalid',
    expectedOk: false,
    expectedCode: 'AMOUNT_MISMATCH',
    description: 'Zero amount must be rejected as an underpayment / amount mismatch',
  },
  {
    id: 'malformed-amount',
    name: 'Unparseable non-numeric payment amount is rejected',
    expectedAmount: '10.0000000',
    actualAmount: 'not-a-number',
    assetCode: 'XLM',
    assetType: 'native',
    scenario: 'invalid',
    expectedOk: false,
    expectedCode: 'AMOUNT_MISMATCH',
    description: 'Malformed string amount must be rejected with AMOUNT_MISMATCH',
  },
];
