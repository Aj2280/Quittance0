# Mobile Payment Demo Script #381

**Purpose**: Guide reviewers through mobile payment scenarios with clear expectations and limitations

**Audience**: Demo observers, reviewers, testers

**Duration**: 5-8 minutes total

---

## Pre-Demo Setup

### Required Equipment
- Desktop computer with Freighter extension installed
- Mobile device (iPhone or Android)
- Both on same network (or WiFi hotspot)

### Invoice Setup
```bash
# Create a testnet invoice
POST /api/invoices
{
  "sellerPublicKey": "GXXXXX...",
  "amount": "10",
  "assetCode": "XLM",
  "memo": "DEMO-TEST-12345"
}

# Response will include:
{
  "qrCode": "data:image/png;...",           // URL QR
  "stellarQrCode": "data:image/png;...",    // SEP-0007 QR
  "paymentUrl": "https://app.quittance/pay/inv-123"
}
```

---

## Demo Scenario 1: Desktop (Works - 1:30 min)

### Goal
Show the "ideal" path — Freighter extension on desktop handles everything automatically.

### Steps

**1. Create Invoice on Desktop (0:00-0:30)**
```
ACTION: Navigate to Quittance create page
→ Fill invoice: seller key, amount, asset
→ Connect Freighter wallet
→ Click "Create Invoice"

EXPECTED: Invoice created, payment page loads
SHOW: Payment page with Freighter "Pay with Wallet" button visible
```

**2. Show Payment Page (0:30-0:50)**
```
ACTION: Point to elements on payment page
→ QR code (scannable)
→ "Pay with Wallet" button (Freighter)
→ Payer name/email fields (optional)

NARRATE: "On desktop with Freighter, this is seamless—click one button and the extension handles it."
```

**3. Complete Payment (0:50-1:30)**
```
ACTION: Click "Pay with Wallet" button
EXPECTED: Freighter extension opens
         → Transaction shows destination, amount, memo
         → Click "Approve"
         → Transaction submitted to Testnet
         → Returns to page
         → Payment status updates to PAID

NARRATE: "Freighter extension handles the entire flow automatically. This is the best experience."
```

**Outcome**: ✅ **Desktop + Freighter = Seamless automatic payment**

---

## Demo Scenario 2: Mobile QR Scan (Works - 2:00 min)

### Goal
Show what mobile users actually see when scanning a QR code.

### Steps

**1. Display QR Code on Desktop (0:00-0:30)**
```
ACTION: On desktop, navigate to invoice payment page
        Display the QR code prominently on screen
        Or display generated QR code image

NARRATE: "When we share an invoice, we give them this QR code. 
         Let's see what happens when a mobile user scans it."
```

**2. Scan with Mobile Device (0:30-1:15)**
```
ACTION: Pick up mobile device
        Open Camera app (iOS) or Google Lens (Android)
        Point at desktop screen showing QR code
        Tap the notification that appears
        
EXPECTED: Payment page opens in browser
         → Mobile layout loads
         → QR code visible at top
         → "Mobile Payment Fallback" section appears
         → Options shown:
            - Deep link buttons (LOBSTR, xBull)
            - Manual payment instructions
            - Copy address/memo/amount buttons
            - Desktop fallback with copy link

NARRATE: "The payment page opens in their mobile browser.
         Since we're on mobile without Freighter extension,
         the page shows them three options..."
```

**3. Show the Three Options (1:15-2:00)**
```
NARRATE:
"Option 1: If they have a Stellar wallet app installed (LOBSTR, xBull),
they can tap one button and it opens their wallet with payment pre-filled.

Option 2: If they don't have an app, they can copy the payment details
and manually enter them into their wallet.

Option 3: If it's too complicated, they can copy this link and open it
on a desktop later where they have Freighter installed."

ACTION: Don't actually complete payment here (we'll do that in next scenario)
```

**Outcome**: ✅ **Mobile QR scan works — page opens with fallback options**

---

## Demo Scenario 3: Mobile Deep Link (Works if App Installed - 2:30 min)

### Goal
Show how one-tap wallet opening works if user has a mobile wallet app.

### Prerequisites
- Install LOBSTR or xBull app on mobile device
- Have it connected to testnet
- Have some XLM for testing

### Steps

**1. Open Payment Page on Mobile (0:00-0:45)**
```
ACTION: On mobile device, open the payment page
        (Use the link from scenario 2, or new invoice)
        
EXPECTED: Mobile Payment Fallback section loads
         "Pay with LOBSTR" and "Pay with xBull" buttons visible
```

**2. Attempt Deep Link (0:45-1:30)**
```
ACTION: Tap "Pay with LOBSTR" button
        
EXPECTED: App attempts to open (1-2 second delay)
         → LOBSTR app launches
         → Payment form prefilled with:
            * Destination: seller public key
            * Amount: invoice amount
            * Memo: invoice memo
            * Asset: XLM or specified asset

NARRATE: "If the wallet app is installed, we jump directly to it
         with the payment already filled in. Users just confirm and send."
```

**3. Complete Payment in Wallet (1:30-2:30)**
```
ACTION: In LOBSTR app:
        → Verify destination, amount, memo are correct
        → Tap "Send" or "Submit"
        → Confirm transaction
        → App shows "Transaction submitted"

EXPECTED: Return to payment page automatically (or manually)
         → Payment status shows PAID
         → "Payment Verified" message appears

NARRATE: "Payment submitted and verified on the Stellar testnet.
         This demonstrates the one-tap flow when a mobile wallet is installed."
```

**Outcome**: ✅ **Mobile deep link works — seamless if wallet app installed**

---

## Demo Scenario 4: Mobile Manual Payment (Works - 2:30 min)

### Goal
Show the fallback for users without a wallet app installed.

### Prerequisites
- Mobile device WITHOUT LOBSTR/xBull installed
- Access to a Stellar testnet wallet (could be desktop tab)

### Steps

**1. Open Payment Page Without Wallet App (0:00-0:45)**
```
ACTION: On mobile (ensure LOBSTR/xBull not installed):
        Open payment page for new invoice
        
EXPECTED: Mobile Payment Fallback section loads
         Deep link buttons attempted but fail silently
         Manual payment section shows with:
         - Copy button for destination address
         - Copy button for memo
         - Amount displayed
         - Instructions shown
```

**2. Copy Payment Details (0:45-1:30)**
```
ACTION: Copy destination address (tap copy button)
EXPECTED: Toast: "Destination address copied"
          Clipboard contains seller public key

ACTION: Copy memo (tap copy button)
EXPECTED: Toast: "Memo copied"
          Clipboard contains invoice memo

NARRATE: "Without a wallet app, users copy these details.
         All payment info is one tap away with copyable text."
```

**3. Manual Payment in Wallet (1:30-2:30)**
```
ACTION: Open any Stellar wallet (on desktop or web)
        Paste destination, amount, memo
        Create and submit payment
        
EXPECTED: Payment submitted
         → Return to mobile page
         → Refresh page
         → Payment status updates to PAID

NARRATE: "The payment verification is automatic—we detect it
         on the Stellar network and update the page."
```

**Outcome**: ✅ **Manual payment works — all details copyable, clear instructions**

---

## Demo Scenario 5: ❌ What NOT to Show

### Scenarios That WILL Fail (Expected Limitations)

❌ **DO NOT attempt:**

**1. Freighter Extension on Mobile Browser**
```
Why: Freighter extension doesn't exist on mobile browsers
     (Manifest V3 doesn't run on mobile)
What happens: Button appears but nothing happens when clicked
              Gives impression of broken UI
Demo impact: Looks like a bug, but it's expected limitation
```

**2. Opening Testnet Invoice on Mainnet Wallet**
```
Why: SEP-0007 QR has no network indicator
     Mobile wallet can't detect network mismatch
What happens: Wallet shows "asset not found" error
              Confusing because QR looks valid
Demo impact: Looks like our bug, not wallet limitation
```

**3. Typing a 50-Character Memo Manually**
```
Why: SEP-0007 MEMO_TEXT limit is 28 bytes
     Our generated memos are 21 chars (safe)
What happens: Wallet rejects the memo as too long
              Payment fails after user entered details
Demo impact: Frustrating demo fail, not showing memo validation
```

---

## Demo Talking Points

### Mobile Payment Reality

**What Works:**
- ✅ QR codes are scannable from any device
- ✅ Payment page is responsive on mobile
- ✅ All details are copyable with one tap
- ✅ Deep links open wallet apps instantly (if installed)
- ✅ Manual payment is practical fallback
- ✅ Payment verification is automatic

**What Doesn't Work:**
- ❌ Freighter extension on mobile browsers
- ❌ Seamless flow without a mobile wallet app
- ❌ Network detection at QR level

**Key Message:**
"We can't bring Freighter to mobile browsers—that's not our limitation, 
that's how browser extensions work. But we can give mobile users every 
other option: they can use a wallet app if they have one, or fall back 
to manual copy/paste which still gets verified automatically."

### Demo Confidence Points

1. **Honest About Limitations**
   - "Freighter is desktop-only by design"
   - "These mobile wallets aren't official Quittance partners yet"
   - "Manual payment isn't slick, but it works"

2. **Show Practical Solutions**
   - "Here are three paths to payment depending on what they have installed"
   - "Every detail is one copy away"
   - "The desktop experience is still much better"

3. **Emphasize What's Automatic**
   - "Payment verification happens instantly—no manual confirmation needed"
   - "We detect the payment on the Stellar network"
   - "No extra steps, no manual email verification"

---

## Post-Demo Q&A Preparation

### Common Questions

**Q: "Why can't we use WalletConnect?"**
A: "WalletConnect is in scope for a future release, but for MVP we're 
   using simpler deep links that work with existing mobile wallets 
   without new infrastructure."

**Q: "What about native Quittance app?"**
A: "That's outside this release—mobile browser support is the MVP. 
   A native app would be smoother, but web with fallbacks gets us 
   80% of the way there."

**Q: "Why is manual payment needed?"**
A: "Not all mobile users have installed a wallet app. Copy/paste is 
   the honest fallback—not slick, but it works and gets verified 
   automatically."

**Q: "Will this frustrate mobile users?"**
A: "Some will find it clunky. But we show them the best path first 
   (wallet app if installed), and every fallback is intentional. 
   We'd rather be honest than pretend mobile is seamless."

---

## Demo Troubleshooting

### QR Code Won't Scan
```
Check: Is QR code clearly visible on screen?
Fix: Increase brightness, move device closer
Alternative: Show URL in browser instead
```

### Mobile Browser Won't Open Payment Page
```
Check: Is payment URL valid?
       Can you access it on desktop first?
Fix: Verify invoice ID, check network connectivity
Alternative: Create new test invoice
```

### Deep Link Won't Open Wallet App
```
Check: Is wallet app actually installed?
       Is it on testnet?
Fix: Install LOBSTR/xBull, switch to testnet
Alternative: Show manual payment path instead
```

### Copy to Clipboard Not Working
```
Check: Browser has permission to access clipboard?
       Is it HTTPS? (required for Clipboard API)
Fix: Use desktop browser if on old mobile browser
Alternative: Manual text selection
```

### Payment Shows as UNPAID After Manual Payment
```
Check: Was memo entered correctly in wallet?
       Did wallet confirm transaction?
Fix: Refresh page, wait 10 seconds, refresh again
     Check explorer for transaction
Alternative: Move to next demo scenario
```

---

## Timing Reference

| Scenario | Duration | Notes |
|----------|----------|-------|
| Desktop (complete) | 1:30 | Shows ideal experience |
| Mobile QR scan | 2:00 | Shows what users see first |
| Mobile Deep Link | 2:30 | Shows one-tap if app installed |
| Mobile Manual | 2:30 | Shows fallback with copy/paste |
| **Total** | **8:30** | Can split across multiple demos |

**Recommended approach:**
- Show all scenarios to get full picture (~8 min)
- OR show Desktop + Mobile QR + Manual for quick demo (~5 min)
- Skip Mobile Deep Link if wallet apps not available

---

## Demo Success Criteria

✅ **Demo succeeds if:**
- Desktop payment with Freighter completes automatically
- Mobile QR scan opens payment page
- Manual payment details are easy to copy
- Payment verification updates page automatically
- Mobile responsive layout works on phone

❌ **Demo fails if:**
- Freighter extension expected to work on mobile (it won't)
- QR code won't scan (check brightness/focus)
- Payment verification stuck (check network connectivity)

---

**Demo created**: 2026-09-13
**Related issue**: #381
**Last updated**: 2026-09-13
