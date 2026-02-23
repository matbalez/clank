import { z } from "zod";

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "username must be 3-32 chars, lowercase, digits, and hyphens");

export const registrationSchema = z.object({
  username: usernameSchema,
  bip321Uri: z
    .string()
    .trim()
    .refine((value) => isLikelyBitcoinUri(value), "bip321Uri must start with bitcoin:")
});

export const updateRegistrationSchema = z.object({
  bip321Uri: z
    .string()
    .trim()
    .refine((value) => isLikelyBitcoinUri(value), "bip321Uri must start with bitcoin:")
});

function isLikelyBitcoinUri(value) {
  return value.startsWith("bitcoin:") && value.length > "bitcoin:".length;
}

export function buildBip353RecordName(username, namespaceDomain) {
  return `${username}.user._bitcoin-payment.${namespaceDomain}`;
}
