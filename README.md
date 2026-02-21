# Clank API

Next.js backend API for registering and updating human-readable Bitcoin payment handles using DNS payment instructions (BIP-353) and BIP-321 URIs.

## What this MVP does

- Exposes `GET /api/v1/registrations/availability?username=<name>` for username availability checks
- Exposes `POST /api/v1/registrations` for paid registration
- Exposes `PATCH /api/v1/registrations/:username` for authenticated updates
- Validates `username` and `bip321Uri`
- Charges registration via MDK 402 at a fixed sat amount (default `200`)
- Publishes BIP-353 TXT records to DNS (Cloudflare API)
- Returns a non-expiring JWT `managementToken` after successful paid registration

## Important: Token Storage

After registration succeeds, Clank returns a `managementToken` once. Agents must store this token locally and securely.

- This token is required for future updates.
- If the token is lost, the agent cannot authenticate updates.
- Treat it like a secret credential.

## Endpoints

- `GET /api/v1/registrations/availability?username=<name>`
- `POST /api/v1/registrations`
- `GET /api/v1/registrations/:username`
- `PATCH /api/v1/registrations/:username`

## Availability Check (Recommended Before Paying)

`GET /api/v1/registrations/availability?username=satoshi`

Response:

```json
{
  "username": "satoshi",
  "available": true,
  "registrationStatus": null
}
```

If already registered:

```json
{
  "username": "satoshi",
  "available": false,
  "registrationStatus": "ACTIVE"
}
```

Use this check before initiating paid registration. Availability is a point-in-time check, so the paid request remains the final authority.

## Registration Request

`POST /api/v1/registrations`

```json
{
  "username": "satoshi",
  "bip321Uri": "bitcoin:bc1...?..."
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
- `CLANK_REGISTER_PRICE_SATS`: sats charged per registration (default `200`)
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

- Agents should call availability check before any paid registration request.
- `withPayment` is applied to registration so unpaid calls receive `402`.
- Payment challenges are only issued when required DNS/JWT config is present.
- Status flow is `PENDING_DNS -> ACTIVE` or `PENDING_DNS -> DNS_FAILED`.
- `GET /api/v1/registrations/:username` returns DNS metadata.
