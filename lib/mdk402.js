import { assertDnsPublisherConfigured } from "@/lib/dns-publisher";

export function buildRegistrationPaymentConfig() {
  const amountSats = Number(process.env.AMA_REGISTER_PRICE_SATS || 200);

  if (!Number.isFinite(amountSats) || amountSats <= 0) {
    throw new Error("AMA_REGISTER_PRICE_SATS must be a positive number");
  }

  const config = {
    amount: () => {
      assertRegistrationReadyForPayment();
      return amountSats;
    },
    currency: "SAT"
  };

  const expirySeconds = process.env.MDK_402_EXPIRY_SECONDS;
  if (expirySeconds) {
    const parsedExpiry = Number(expirySeconds);
    if (Number.isFinite(parsedExpiry) && parsedExpiry > 0) {
      config.expirySeconds = parsedExpiry;
    }
  }

  return config;
}

function assertRegistrationReadyForPayment() {
  if (!process.env.AMA_NAMESPACE_DOMAIN) {
    throw new Error("AMA_NAMESPACE_DOMAIN is required");
  }

  assertDnsPublisherConfigured();
}
