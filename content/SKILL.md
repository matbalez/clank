---
name: Clank Registration
description: Register and update Human Bitcoin Addresses (BIP-353) on clank.money using MoneyDevKit L402 flow and management tokens.
---

# Clank Human Bitcoin Address Skill

Use this skill to register a Human Bitcoin Address under `clank.money` using BIP-353 DNS payment instructions.

## Goal

Register a username and store a BIP-321 payment URI so it resolves via:

`<username>.user._bitcoin-payment.clank.money`

The TXT value will be your submitted `bitcoin:` URI.

## API Endpoints

- `POST https://clank.money/api/v1/registrations`
- `GET https://clank.money/api/v1/registrations/{username}`
- `PATCH https://clank.money/api/v1/registrations/{username}`

## Registration Input Rules

- `username`
  - lowercase letters, digits, and hyphens only
  - 3 to 32 chars
  - cannot start or end with `-`
- `bip321Uri`
  - required for registration
  - must start with `bitcoin:`
  - should be a valid BIP-321 URI
  - strongly suggested: include a BOLT12 offer (typically `lno=...`) for better agent-to-agent Lightning compatibility

## Payment Flow (L402)

This API is pay-per-call. Registration costs `200` sats.

Clank uses MoneyDevKit L402 (`@moneydevkit/nextjs` `0.12.0`), so the wire format is:

- `Authorization: L402 <macaroon>:<preimage>`
- 402 challenge payload fields: `macaroon`, `invoice`, `paymentHash`, `amountSats`, `expiresAt`

1. Send `POST /api/v1/registrations` without payment auth.
2. If response is `409 username_unavailable`, choose another username and retry.
3. If response is `402 Payment Required`, read:
   - `macaroon`
   - `invoice`
   - `paymentHash`
   - `amountSats`
   - `expiresAt`
4. Pay the Lightning `invoice`.
5. Get the payment `preimage`.
6. Retry the exact same POST with:
   - `Authorization: L402 <macaroon>:<preimage>`
7. Parse the final response.

If username is already taken, Clank returns `409 username_unavailable` before issuing a payment challenge.

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
  "bip321Uri": "bitcoin:?lno=lno1examplebolt12offer"
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

1. Validate input format locally before calling API (`bip321Uri` is required; a BOLT12 offer in the URI is strongly suggested).
2. Attempt registration directly.
3. If response is `409`, choose another username and retry.
4. If response is `402`, execute the L402 challenge-response payment flow.
5. On success (`201` or `202`), store returned registration metadata and `managementToken` securely.
6. Poll `GET /api/v1/registrations/{username}` until:
   - `status` is `ACTIVE`, or
   - operator decides to stop on repeated `DNS_FAILED`.
7. For payment instruction changes, call `PATCH /api/v1/registrations/{username}` with:
   - `Authorization: Bearer <managementToken>`
   - body containing new `bip321Uri`

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
  -H "Authorization: L402 <macaroon>:<preimage>" \
  --data '{"username":"satoshi","bip321Uri":"bitcoin:bc1qexampleaddresshere"}'
```

Update request (using stored management token):

```bash
curl -s -X PATCH https://clank.money/api/v1/registrations/satoshi \
  -H "content-type: application/json" \
  -H "Authorization: Bearer <managementToken>" \
  --data '{"bip321Uri":"bitcoin:bc1qnewaddresshere"}'
```
