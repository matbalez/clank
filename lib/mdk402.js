import { assertDnsPublisherConfigured } from "@/lib/dns-publisher";

export function buildRegistrationPaymentConfig() {
  const amountSats = Number(process.env.CLANK_REGISTER_PRICE_SATS || 200);

  if (!Number.isFinite(amountSats) || amountSats <= 0) {
    throw new Error("CLANK_REGISTER_PRICE_SATS must be a positive number");
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
  if (!process.env.CLANK_NAMESPACE_DOMAIN) {
    throw new Error("CLANK_NAMESPACE_DOMAIN is required");
  }

  assertDnsPublisherConfigured();
}
