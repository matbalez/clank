# Clank API

Next.js backend API for registering and updating human-readable Bitcoin payment handles using DNS payment instructions (BIP-353) and BIP-321 URIs.

## What this MVP does

- Exposes `POST /api/v1/registrations` for paid registration
- Exposes `PATCH /api/v1/registrations/:username` for authenticated updates
- Validates `username` and required `bip321Uri`
- Charges registration via MoneyDevKit L402 at a fixed sat amount (default `999`)
- Publishes BIP-353 TXT records to DNS (Cloudflare API)
- Returns a non-expiring JWT `managementToken` after successful paid registration

## Important: Token Storage

After registration succeeds, Clank returns a `managementToken` once. Agents must store this token locally and securely.

- This token is required for future updates.
- If the token is lost, the agent cannot authenticate updates.
- Treat it like a secret credential.

## Endpoints

- `POST /api/v1/registrations`
- `GET /api/v1/registrations/:username`
- `PATCH /api/v1/registrations/:username`

Clank also enforces a pre-payment username check on `POST /api/v1/registrations`; if taken, it returns `409 username_unavailable` before payment challenge issuance.

Registration is the only way to claim a name. Agents should attempt registration directly and handle `409 username_unavailable` by trying a different username.

## Registration Request

`POST /api/v1/registrations`

`bip321Uri` is required. For best interoperability, strongly consider including a BOLT12 offer in the URI (commonly via `lno=...`).

```json
{
  "username": "satoshi",
  "bip321Uri": "bitcoin:?lno=lno1examplebolt12offer"
}
```

## Registration Response (201)

```json
{
  "id": "...",
  "username": "satoshi",
  "bip321Uri": "bitcoin:bc1...?...",
  "namespaceDomain": "clank.money",
  "bip353RecordName": "satoshi.user._bitcoin-payment.clank.money",
  "txtValue": "bitcoin:bc1...?...",
  "status": "ACTIVE",
  "managementToken": "<store-this-token-securely>",
  "createdAt": "2026-02-19T00:00:00.000Z"
}
```

## Registration Response (202)

If payment succeeds but DNS publish fails, the API still records the paid registration and returns `202` with:

- `status: "DNS_FAILED"`
- `dnsLastError` describing provider failure
- `publishAttempts` count
- `managementToken` still returned (store it)

## Update Request

`PATCH /api/v1/registrations/:username`

Headers:

- `Authorization: Bearer <managementToken>`

Body:

```json
{
  "bip321Uri": "bitcoin:bc1qnew...?..."
}
```

## Update Responses

- `200` when TXT publish succeeds (`status: "ACTIVE"`)
- `202` when TXT publish fails (`status: "DNS_FAILED"`)
- `401` when token is missing/invalid
- `403` when token subject does not match `:username`

## Environment

Copy `.env.example` to `.env` and fill values.

- `CLANK_NAMESPACE_DOMAIN`: your purchased parent domain
- `CLANK_REGISTER_PRICE_SATS`: sats charged per registration (default `999`)
- `MDK_402_EXPIRY_SECONDS`: optional token/invoice expiry (default `900`)
- `CLANK_DNS_PROVIDER`: DNS backend (`cloudflare` currently supported)
- `CLANK_DNS_TTL_SECONDS`: TXT TTL (default `60`)
- `CLANK_MANAGEMENT_JWT_SECRET`: signing secret for management tokens
- `CLANK_MANAGEMENT_JWT_ISSUER`: JWT issuer (default `clank.money`)
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

- `withPayment` is applied to registration so unpaid calls receive `402`.
- Payment challenges are only issued when required DNS/JWT config is present.
- Taken usernames return `409 username_unavailable` before payment challenge issuance.
- `bip321Uri` is required for registration; including a BOLT12 offer is strongly suggested.
- Status flow is `PENDING_DNS -> ACTIVE` or `PENDING_DNS -> DNS_FAILED`.
- `GET /api/v1/registrations/:username` returns DNS metadata.
