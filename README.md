# Clank API

Next.js backend API for registering human-readable Bitcoin payment handles using DNS payment instructions (BIP-353) and BIP-321 URIs.

## What this MVP does

- Exposes `POST /api/v1/registrations`
- Validates `username` and `bip321Uri`
- Charges via MDK 402 wrapper at a fixed sat amount (default `200`) using `withPayment`
- Stores registrations via Prisma
- Publishes BIP-353 TXT records to DNS (Cloudflare API) after successful paid registration

## Request shape

`POST /api/v1/registrations`

```json
{
  "username": "satoshi",
  "bip321Uri": "bitcoin:bc1...?..."
}
```

## Response (201)

```json
{
  "id": "...",
  "username": "satoshi",
  "bip321Uri": "bitcoin:bc1...?...",
  "namespaceDomain": "clank.money",
  "bip353RecordName": "satoshi.user._bitcoin-payment.clank.money",
  "txtValue": "bitcoin:bc1...?...",
  "status": "ACTIVE",
  "createdAt": "2026-02-19T00:00:00.000Z"
}
```

## Response (202)

If payment succeeds but DNS publish fails, the API still records the paid registration and returns `202` with:

- `status: "DNS_FAILED"`
- `dnsLastError` describing the provider failure
- `publishAttempts` count for retry workflows

## Environment

Copy `.env.example` to `.env` and fill values.

- `CLANK_NAMESPACE_DOMAIN`: your purchased parent domain
- `CLANK_REGISTER_PRICE_SATS`: sats charged per registration (default `200`)
- `MDK_402_EXPIRY_SECONDS`: optional token/invoice expiry (default `900`)
- `CLANK_DNS_PROVIDER`: DNS backend (`cloudflare` currently supported)
- `CLANK_DNS_TTL_SECONDS`: TXT TTL (default `60`)
- `CF_ZONE_ID`, `CF_API_TOKEN`: Cloudflare zone + token with DNS edit permissions
- `MDK_ACCESS_TOKEN`, `MDK_MNEMONIC`: required MDK credentials

## Local setup

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
```

## Notes

- `withPayment` is applied directly to the registration endpoint so unpaid calls receive `402`.
- Payment challenges are only issued when required DNS config is present; misconfiguration returns `500` before invoice creation.
- Status flow is `PENDING_DNS -> ACTIVE` or `PENDING_DNS -> DNS_FAILED`.
- `GET /api/v1/registrations/:username` returns DNS publish metadata for monitoring/retry tooling.
