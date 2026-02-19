function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function getDnsProvider() {
  return (process.env.CLANK_DNS_PROVIDER || "cloudflare").toLowerCase();
}

function getDnsTtlSeconds() {
  const raw = process.env.CLANK_DNS_TTL_SECONDS;
  if (!raw) {
    return 60;
  }

  const ttl = Number(raw);
  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new Error("CLANK_DNS_TTL_SECONDS must be a positive number");
  }

  return ttl;
}

async function parseResponseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function cloudflareRequest(path, init = {}) {
  const zoneId = requiredEnv("CF_ZONE_ID");
  const apiToken = requiredEnv("CF_API_TOKEN");

  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });

  const json = await parseResponseJson(response);

  if (!response.ok || !json?.success) {
    const message = json?.errors?.[0]?.message || `Cloudflare API request failed (${response.status})`;
    throw new Error(message);
  }

  return json;
}

async function upsertCloudflareTxtRecord({ recordName, txtValue }) {
  const query = new URLSearchParams({
    type: "TXT",
    name: recordName
  });

  const findResponse = await cloudflareRequest(`/dns_records?${query.toString()}`, {
    method: "GET"
  });

  const existing = Array.isArray(findResponse.result)
    ? findResponse.result.find((record) => record.type === "TXT" && record.name === recordName)
    : null;

  const payload = {
    type: "TXT",
    name: recordName,
    content: txtValue,
    ttl: getDnsTtlSeconds()
  };

  if (existing?.id) {
    const updateResponse = await cloudflareRequest(`/dns_records/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    return {
      provider: "cloudflare",
      recordId: updateResponse.result?.id || existing.id
    };
  }

  const createResponse = await cloudflareRequest("/dns_records", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  return {
    provider: "cloudflare",
    recordId: createResponse.result?.id || null
  };
}

export async function publishPaymentInstructionTxt({ recordName, txtValue }) {
  const provider = getDnsProvider();

  if (provider === "cloudflare") {
    return upsertCloudflareTxtRecord({ recordName, txtValue });
  }

  throw new Error(`Unsupported CLANK_DNS_PROVIDER: ${provider}`);
}

export function assertDnsPublisherConfigured() {
  const provider = getDnsProvider();

  if (provider === "cloudflare") {
    requiredEnv("CF_ZONE_ID");
    requiredEnv("CF_API_TOKEN");
    getDnsTtlSeconds();
    return;
  }

  throw new Error(`Unsupported CLANK_DNS_PROVIDER: ${provider}`);
}
