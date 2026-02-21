# Clank Money Address Registration Skill

Use this skill to register a human-readable Bitcoin payment address under `clank.money` using BIP-353 DNS payment instructions.

## Goal

Register a username and store a BIP-321 payment URI so it resolves via:

`<username>.user._bitcoin-payment.clank.money`

The TXT value will be your submitted `bitcoin:` URI.

## API Endpoints

- `GET https://clank.money/api/v1/registrations/availability?username={username}`
- `POST https://clank.money/api/v1/registrations`
- `GET https://clank.money/api/v1/registrations/{username}`
- `PATCH https://clank.money/api/v1/registrations/{username}`

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

1. Call `GET /api/v1/registrations/availability?username={username}`.
2. If `available` is `false`, stop and choose another username.
3. Send `POST /api/v1/registrations` without payment auth.
4. If response is `402 Payment Required`, read:
   - `token`
   - `invoice`
   - `paymentHash`
   - `amountSats`
   - `expiresAt`
5. Pay the Lightning `invoice`.
6. Get the payment `preimage`.
7. Retry the exact same POST with:
   - `Authorization: MDK402 <token>:<preimage>`
8. Parse the final response.

Note: availability is point-in-time. The paid registration request is the final authority.

## Management Token (Critical)

After successful paid registration, Clank returns `managementToken`.

- Store this token locally and securely.
- This token is required for all future updates.
- If lost, the agent cannot authenticate updates.
- Treat it as a secret credential.

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
  - `managementToken` returned
- `202 Accepted`
  - payment was accepted
  - registration stored
  - DNS publish failed temporarily
  - `status` is `DNS_FAILED`
  - `managementToken` returned
  - inspect `dnsLastError` and retry via operator workflow

## Common Error Outcomes

- `400 invalid_json` or `400 invalid_request`
- `402 payment_required`
- `409 username_unavailable`
- `500 misconfigured` or `500 pricing_error`
- `401 authorization_required` or `401 invalid_management_token` (update only)
- `403 token_username_mismatch` (update only)

## Minimal Agent Procedure

1. Validate input format locally before calling API.
2. Check username availability with `GET /api/v1/registrations/availability?username={username}`.
3. If available, execute MDK402 challenge-response payment flow.
4. On success (`201` or `202`), store returned registration metadata and `managementToken` securely.
5. Poll `GET /api/v1/registrations/{username}` until:
   - `status` is `ACTIVE`, or
   - operator decides to stop on repeated `DNS_FAILED`.
6. For payment instruction changes, call `PATCH /api/v1/registrations/{username}` with:
   - `Authorization: Bearer <managementToken>`
   - body containing new `bip321Uri`

## cURL Pattern

Availability check:

```bash
curl -s "https://clank.money/api/v1/registrations/availability?username=satoshi"
```

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

Update request (using stored management token):

```bash
curl -s -X PATCH https://clank.money/api/v1/registrations/satoshi \
  -H "content-type: application/json" \
  -H "Authorization: Bearer <managementToken>" \
  --data '{"bip321Uri":"bitcoin:bc1qnewaddresshere"}'
```
