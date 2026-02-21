import jwt from "jsonwebtoken";

const DEFAULT_SCOPE = "registration:update";

function getJwtSecret() {
  const secret = process.env.CLANK_MANAGEMENT_JWT_SECRET;
  if (!secret) {
    throw new Error("CLANK_MANAGEMENT_JWT_SECRET is required");
  }

  return secret;
}

function getIssuer() {
  return process.env.CLANK_MANAGEMENT_JWT_ISSUER || process.env.CLANK_NAMESPACE_DOMAIN || "clank.money";
}

export function issueManagementToken(username) {
  return jwt.sign(
    {
      scope: DEFAULT_SCOPE
    },
    getJwtSecret(),
    {
      issuer: getIssuer(),
      subject: username
    }
  );
}

export function verifyManagementToken(token) {
  const payload = jwt.verify(token, getJwtSecret(), {
    issuer: getIssuer()
  });

  if (typeof payload !== "object" || payload === null) {
    throw new Error("invalid_management_token");
  }

  if (payload.scope !== DEFAULT_SCOPE) {
    throw new Error("invalid_management_token_scope");
  }

  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("invalid_management_token_subject");
  }

  return payload;
}

export function extractBearerToken(headerValue) {
  if (!headerValue) {
    return null;
  }

  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function assertManagementTokenConfigured() {
  getJwtSecret();
}
