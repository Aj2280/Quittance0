# Structured logging for the invoice loop

## Contract

Every operational record is one JSON object on stdout or stderr. Event names
and safe fields are defined in backend/src/observability/log-events.ts. The
builder copies only the allowlisted fields for that event; it never serializes
a request body, response body, invoice, Horizon response, or Error object.

Base fields on every event:

| Field | Meaning |
| --- | --- |
| timestamp | UTC ISO-8601 emission time |
| level | info, warn, or error |
| event | stable taxonomy name |
| requestId | one server-generated request correlation ID |
| service | api or web |
| environment | deployment name when configured |

Identifiers use invoiceRef, sellerRef, and txRef. They are the first 16 hex
characters of HMAC-SHA256 under LOG_FINGERPRINT_KEY. The key is a deployment
secret and is never logged. If it is absent, references become redacted rather
than falling back to the raw value.

## Correlation

Express should generate one request ID at the first middleware, attach it to
the request, return it as X-Request-Id, and reuse it in every handler and
Horizon call. Do not trust a caller-provided ID as the log key; it may contain
log injection text or cause unrelated users to share a trace. If an upstream
platform ID is needed, store a validated version in a separate platformTraceId
field in a later taxonomy revision.

The browser creates one request ID for the pay action and sends it in
X-Request-Id. The API still replaces it with a server ID and may return both IDs
once a validated parent-correlation field exists. The proof download is
client-side today, so proof.downloaded is optional best-effort client telemetry.
It must never block or alter the download.

## Events

| Event | Level | Required event fields | Emission point |
| --- | --- | --- | --- |
| invoice.create.started | info | sellerRef, assetCode, network, storage | after request validation |
| invoice.create.succeeded | info | sellerRef, invoiceRef, assetCode, network, storage, durationMs | after response data is ready |
| invoice.create.rejected | warn | sellerRef when available, errorCode, network, storage, durationMs | one terminal create failure |
| payment.attempt.started | info | invoiceRef, network | immediately before wallet flow |
| payment.attempt.submitted | info | invoiceRef, txRef, network, durationMs | wallet returns transaction hash |
| payment.attempt.rejected | warn | invoiceRef, errorCode, network, durationMs | wallet or submission rejects |
| payment.verify.started | info | invoiceRef, txRef, network | after hash validation, before Horizon |
| payment.verify.rejected | warn | invoiceRef, txRef, errorCode, network, durationMs | one terminal verification rejection |
| invoice.paid | info | invoiceRef, sellerRef, txRef, assetCode, network, storage, durationMs | committed PENDING to PAID transition |
| proof.downloaded | info | invoiceRef, txRef, proofFormat | PDF, text, or email proof action |
| horizon.request.failed | warn or error | operation, errorCode, network, attempt, durationMs | failed Horizon boundary |

Started and terminal events share requestId. A request emits exactly one
succeeded or rejected terminal event. Automatic monitoring creates a fresh
request ID per observed operation because it has no HTTP request.

errorCode is a bounded stable code such as MEMO_MISMATCH, HORIZON_TIMEOUT, or
DATABASE_UNAVAILABLE. Error messages and stack traces go to a restricted debug
sink only if the deployment has one; they are not fields in the operational
event.

## Success example

```json
{"timestamp":"2026-09-13T10:00:00.517Z","level":"info","event":"invoice.paid","requestId":"req-8a7e81bbd9ef2731","service":"api","environment":"production","invoiceRef":"b67182fb83edb7ca","sellerRef":"eb8f707a26e08a9c","txRef":"69246b51fd8bb68c","assetCode":"XLM","network":"TESTNET","storage":"postgres","durationMs":418}
```

The references are deployment-keyed fingerprints. They are not invoice IDs,
wallet addresses, or transaction hashes.

## Reject example

```json
{"timestamp":"2026-09-13T10:01:14.012Z","level":"warn","event":"payment.verify.rejected","requestId":"req-12a570aa9f2fa3c4","service":"api","environment":"production","invoiceRef":"b67182fb83edb7ca","txRef":"930dc03a1f4d4bc7","errorCode":"MEMO_MISMATCH","network":"TESTNET","durationMs":92}
```

The log says why verification failed and lets operators group the request
without exposing the expected or received memo.

## Never log

- secret keys, seed phrases, signatures, auth headers, cookies, or tokens;
- raw seller or payer wallet addresses;
- invoice IDs, public pay links, QR payloads, or full transaction hashes;
- invoice memos, descriptions, customer names, seller names, or email;
- amount together with a linkable seller, payer, invoice, or transaction;
- XDR, Horizon response bodies, request bodies, or response bodies;
- wallet balances, account history, or operations unrelated to this invoice;
- IP address or user agent unless a separate retention and consent policy
  explicitly requires them;
- raw Error objects, which may embed URLs, request configuration, or payloads.

Asset code, network, storage mode, duration, retry count, bounded error code,
and keyed references are allowed. Adding a field requires updating the event
allowlist, privacy review, and tests.

## “Do not dox other wallets” checklist

- Query Horizon only for the invoice or configured seller account needed by
  the operation.
- Never dump an account payments page to logs.
- Fingerprint each identifier independently; do not concatenate raw values
  before logging.
- Keep LOG_FINGERPRINT_KEY outside source control and use different keys in
  development, preview, and production.
- Limit production log access and retention in the hosting provider.
- Do not export production logs into demo evidence. Use dedicated Testnet
  accounts and synthetic request IDs.
- Treat support screenshots as data exports; crop identifiers and PII.
- Verify rejection logs contain a stable code without expected/received values.
- Review new event fields against the allowlist test before merge.

Key rotation intentionally breaks reference continuity. Rotate immediately if
the key is disclosed; otherwise rotate on the log-retention boundary.

## Metrics without Redis

The JSON stream is the source for low-cardinality metrics. Render, Vercel, or a
log drain can count events and group only by event, errorCode, network,
assetCode, storage, and environment.

Useful initial metrics:

| Metric | Derivation |
| --- | --- |
| invoices_created_total | count invoice.create.succeeded |
| invoice_create_reject_total | count invoice.create.rejected by errorCode |
| verification_total | count invoice.paid plus payment.verify.rejected |
| verification_reject_total | count payment.verify.rejected by errorCode |
| horizon_failure_total | count horizon.request.failed by errorCode |
| verify_duration_ms | distribution of terminal verify durationMs |
| proof_download_total | count proof.downloaded by proofFormat |

Do not use invoiceRef, sellerRef, txRef, or requestId as metric labels; their
cardinality grows without bound. In-process counters are diagnostic only
because serverless instances restart and scale independently. Durable metrics
come from the provider's log query, drain, or a later OpenTelemetry exporter.
No Redis queue is needed.

Suggested alerts are a sustained Horizon failure rate, no successful verify
events during known demo traffic, and p95 verify duration above the pay page's
polling interval.

## Rollout

1. Add correlation middleware to both Express entrypoints.
2. Replace free-text request logging with one completion event.
3. Emit create and verify pairs from the shared invoice handlers.
4. Emit paid from the storage transition only after commit.
5. Add client pay/proof events as optional telemetry.
6. Configure LOG_FINGERPRINT_KEY and provider retention.
7. Build dashboards from bounded fields, then remove duplicate console output.

During rollout, do not wrap console globally. Migrations, local developer
messages, and third-party library output have different audiences and should be
handled separately.
