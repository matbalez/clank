# Clank Money Address Registration Skill

Use this skill to register a human-readable Bitcoin payment address under `clank.money` using BIP-353 DNS payment instructions.

## Goal

Register a username and store a BIP-321 payment URI so it resolves via:

`<username>.user._bitcoin-payment.clank.money`

The TXT value will be your submitted `bitcoin:` URI.

## API Endpoints

- `POST https://clank.money/api/v1/registrations`
- `GET https://clank.money/api/v1/registrations/{username}`

## Registration Input Rules

- `username`
  - lowercase letters, digits, and hyphens only
  - 3 to 32 chars
  - cannot start or end with `-`
- `bip321Uri`
  - must start with `bitcoin:`
  - should be a valid BIP-321 URI

## Payment Flow (MDK402)

This API is pay-per-call. Registration costs `200` sats.

1. Send `POST /api/v1/registrations` without payment auth.
2. If response is `402 Payment Required`, read:
   - `token`
   - `invoice`
   - `paymentHash`
   - `amountSats`
   - `expiresAt`
3. Pay the Lightning `invoice`.
4. Get the payment `preimage`.
5. Retry the exact same POST with:
   - `Authorization: MDK402 <token>:<preimage>`
6. Parse the final response.

## Request Example

```json
{
  "username": "satoshi",
  "bip321Uri": "bitcoin:bc1qexampleaddresshere?amount=0.00001"
}
```

## Successful Outcomes

- `201 Created`
  - registration succeeded
  - DNS TXT publish succeeded
  - `status` is `ACTIVE`
- `202 Accepted`
  - payment was accepted
  - registration stored
  - DNS publish failed temporarily
  - `status` is `DNS_FAILED`
  - inspect `dnsLastError` and retry via operator workflow

## Common Error Outcomes

- `400 invalid_json` or `400 invalid_request`
- `402 payment_required`
- `409 username_unavailable`
- `500 misconfigured` or `500 pricing_error`

## Minimal Agent Procedure

1. Validate input format locally before calling API.
2. Execute MDK402 challenge-response payment flow.
3. On success (`201` or `202`), store returned registration metadata.
4. Poll `GET /api/v1/registrations/{username}` until:
   - `status` is `ACTIVE`, or
   - operator decides to stop on repeated `DNS_FAILED`.

## cURL Pattern

Unauthenticated request:

```bash
curl -s -X POST https://clank.money/api/v1/registrations \
  -H "content-type: application/json" \
  --data '{"username":"satoshi","bip321Uri":"bitcoin:bc1qexampleaddresshere"}'
```

Authenticated retry (after paying invoice):

```bash
curl -s -X POST https://clank.money/api/v1/registrations \
  -H "content-type: application/json" \
  -H "Authorization: MDK402 <token>:<preimage>" \
  --data '{"username":"satoshi","bip321Uri":"bitcoin:bc1qexampleaddresshere"}'
```
