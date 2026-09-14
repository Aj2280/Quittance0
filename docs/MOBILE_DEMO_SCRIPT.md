# Mobile Payment Feasibility Demo Script

## Purpose

This script provides step-by-step instructions for demonstrating and verifying mobile pay link behavior, device detection, and fallback flows implemented for Quittance invoice payments.

---

## Prerequisites

1. Running frontend instance (`npm run dev` in `frontend/`).
2. Running mock backend or live Testnet API (`npm run dev` in `backend/`).
3. Test invoice created on Stellar Testnet (or mock invoice ID).
4. Testing environments:
   - **Environment A (Desktop):** Desktop Google Chrome with Freighter installed.
   - **Environment B (Mobile iOS):** iOS Safari (physical iPhone or Xcode Simulator).
   - **Environment C (Mobile Android):** Android Chrome (physical Android device or Android Emulator).

---

## Demonstration Steps

### Step 1: Baseline Desktop Flow Verification
1. Open invoice URL in Desktop Chrome: `http://localhost:3000/pay/<INVOICE_ID>`
2. **Observe:**
   - The desktop payment controls render with `Pay with Wallet` and `FreighterInstallPrompt` (or active `PaymentButton` if Freighter is unlocked).
   - The standard QR code is displayed for camera scanning.
   - Mobile fallback guidance is **not** displayed.

### Step 2: Mobile Device Detection
1. Open the same invoice URL in iOS Safari or Android Chrome (or simulate via Chrome DevTools Mobile Emulation with iPhone/Pixel user agent and touch enabled).
2. **Observe:**
   - The header displays the invoice details and amount without forcing login or account creation.
   - The desktop Freighter installation prompt is suppressed.
   - The `Mobile Device Detected` card appears with:
     - Badge: `Mobile Device Detected`
     - Headline: `Freighter is a desktop extension`
     - Explanation: `Mobile browsers cannot run the Freighter extension to sign transactions directly. Use one of the fallback options below to complete payment.`
     - Auth note: `No account or Google login required. Payment verifies directly on the Stellar ledger.`

### Step 3: Tier 1 - Mobile Stellar Wallet (SEP-0007)
1. In the `Pay with Mobile Wallet` card, observe the `Open in Stellar Wallet` button.
2. Inspect or tap the link:
   - Verify protocol URI starts with `web+stellar:pay?destination=...&amount=...&memo=...&memo_type=MEMO_TEXT`
   - If a compatible mobile wallet (LOBSTR or xBull) is installed on the device, confirm that the OS offers to open the wallet application.
   - In desktop emulation mode, right-click the link to verify the standards-compliant SEP-0007 parameters.

### Step 4: Tier 2 - Manual On-Chain Payment Details
1. In the `Copy Payment Details` card, review the three copy blocks:
   - Destination address with one-click copy button.
   - Invoice memo with copy button and warning: `Always include the exact memo. Verification will fail without it.`
   - Amount and asset denomination with copy button.
2. Tap each copy button:
   - Observe toast confirmation (`Copied Destination Address to clipboard`, etc.).
   - Confirm clipboard contains the exact unformatted string.

### Step 5: Tier 3 - Desktop Handoff
1. In the `Open on Desktop` card, tap `Copy Payment Link`.
2. Observe visual confirmation and toast feedback.
3. Paste the URL into a desktop browser with Freighter to verify seamless continuation.

### Step 6: Advanced Toggle - Extension View on Mobile
1. Under the mobile fallback container, click `Show desktop extension controls`.
2. Confirm the desktop wallet card renders for power users running experimental extension-enabled mobile browsers.
3. Click `Return to mobile guidance` to revert to the primary mobile interface.

---

## Verification Checklist

| Checkpoint | Expected Result | Pass / Fail |
| :--- | :--- | :--- |
| **No Mandatory Auth** | Invoice details and payment instructions viewable without Google login or account setup | PASS |
| **Device Detection** | Mobile user agents automatically trigger mobile fallback interface | PASS |
| **Desktop Isolation** | Desktop browsers retain standard Freighter one-click payment layout | PASS |
| **SEP-0007 URI** | Generates valid `web+stellar:pay` with destination, amount, memo, and memo_type | PASS |
| **Clipboard Feedback** | Individual copy buttons trigger visual checkmarks and Sonner toasts | PASS |
| **Copy Purity** | Zero emojis and clear non-technical language throughout interface | PASS |
