import { buildBip353RecordName, registrationSchema, updateRegistrationSchema } from "./clank.js";

export async function runRegistrationPrecheck({ body, namespaceDomain, db }) {
  const parseResult = registrationSchema.safeParse(body);
  if (!parseResult.success) {
    return {
      status: 400,
      payload: {
        error: "invalid_request",
        details: parseResult.error.flatten()
      }
    };
  }

  if (!namespaceDomain) {
    return {
      status: 500,
      payload: {
        error: "misconfigured",
        details: "CLANK_NAMESPACE_DOMAIN is required"
      }
    };
  }

  const { username } = parseResult.data;
  const existing = await db.registration.findUnique({
    where: { username },
    select: {
      id: true
    }
  });

  if (existing) {
    return {
      status: 409,
      payload: {
        error: "username_unavailable",
        details: "username is already registered"
      }
    };
  }

  return null;
}

export async function runRegistrationFlow({
  body,
  namespaceDomain,
  db,
  publishPaymentInstructionTxt,
  issueManagementToken
}) {
  const parseResult = registrationSchema.safeParse(body);

  if (!parseResult.success) {
    return {
      status: 400,
      payload: {
        error: "invalid_request",
        details: parseResult.error.flatten()
      }
    };
  }

  if (!namespaceDomain) {
    return {
      status: 500,
      payload: {
        error: "misconfigured",
        details: "CLANK_NAMESPACE_DOMAIN is required"
      }
    };
  }

  const { username, bip321Uri } = parseResult.data;

  let created;
  try {
    created = await db.registration.create({
      data: {
        username,
        bip321Uri,
        namespaceDomain,
        bip353RecordName: buildBip353RecordName(username, namespaceDomain),
        status: "PENDING_DNS"
      }
    });
  } catch (error) {
    if (error?.code === "P2002") {
      return {
        status: 409,
        payload: {
          error: "username_unavailable",
          details: "username is already registered"
        }
      };
    }

    throw error;
  }

  const published = await publishRegistrationDns({
    registration: created,
    nextBip321Uri: created.bip321Uri,
    db,
    publishPaymentInstructionTxt
  });

  const managementToken = issueManagementToken(published.username);

  return {
    status: published.status === "ACTIVE" ? 201 : 202,
    payload: formatRegistrationResponse(published, { managementToken })
  };
}

export async function runUpdateFlow({
  username,
  body,
  authorizationHeader,
  db,
  publishPaymentInstructionTxt,
  assertManagementTokenConfigured,
  extractBearerToken,
  verifyManagementToken
}) {
  try {
    assertManagementTokenConfigured();
  } catch (error) {
    return {
      status: 500,
      payload: {
        error: "misconfigured",
        details: error.message
      }
    };
  }

  const token = extractBearerToken(authorizationHeader);
  if (!token) {
    return {
      status: 401,
      payload: {
        error: "authorization_required",
        details: "Use Authorization: Bearer <managementToken>"
      }
    };
  }

  let tokenPayload;
  try {
    tokenPayload = verifyManagementToken(token);
  } catch {
    return {
      status: 401,
      payload: {
        error: "invalid_management_token"
      }
    };
  }

  if (tokenPayload.sub !== username) {
    return {
      status: 403,
      payload: {
        error: "token_username_mismatch"
      }
    };
  }

  const parseResult = updateRegistrationSchema.safeParse(body);
  if (!parseResult.success) {
    return {
      status: 400,
      payload: {
        error: "invalid_request",
        details: parseResult.error.flatten()
      }
    };
  }

  const existing = await db.registration.findUnique({
    where: { username }
  });

  if (!existing) {
    return {
      status: 404,
      payload: {
        error: "not_found"
      }
    };
  }

  const updated = await publishRegistrationDns({
    registration: existing,
    nextBip321Uri: parseResult.data.bip321Uri,
    db,
    publishPaymentInstructionTxt
  });

  return {
    status: updated.status === "ACTIVE" ? 200 : 202,
    payload: formatRegistrationResponse(updated)
  };
}

async function publishRegistrationDns({ registration, nextBip321Uri, db, publishPaymentInstructionTxt }) {
  try {
    const dnsResult = await publishPaymentInstructionTxt({
      recordName: registration.bip353RecordName,
      txtValue: nextBip321Uri
    });

    return db.registration.update({
      where: { id: registration.id },
      data: {
        bip321Uri: nextBip321Uri,
        status: "ACTIVE",
        dnsProvider: dnsResult.provider,
        dnsRecordId: dnsResult.recordId,
        dnsPublishedAt: new Date(),
        dnsLastError: null,
        publishAttempts: {
          increment: 1
        }
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown DNS publish error";

    return db.registration.update({
      where: { id: registration.id },
      data: {
        bip321Uri: nextBip321Uri,
        status: "DNS_FAILED",
        dnsLastError: message.slice(0, 500),
        publishAttempts: {
          increment: 1
        }
      }
    });
  }
}

export function formatRegistrationResponse(registration, { managementToken } = {}) {
  const payload = {
    id: registration.id,
    username: registration.username,
    bip321Uri: registration.bip321Uri,
    namespaceDomain: registration.namespaceDomain,
    bip353RecordName: registration.bip353RecordName,
    txtValue: registration.bip321Uri,
    status: registration.status,
    dnsProvider: registration.dnsProvider,
    dnsRecordId: registration.dnsRecordId,
    dnsPublishedAt: registration.dnsPublishedAt?.toISOString() || null,
    dnsLastError: registration.dnsLastError || null,
    publishAttempts: registration.publishAttempts,
    createdAt: registration.createdAt.toISOString(),
    updatedAt: registration.updatedAt?.toISOString() || null
  };

  if (managementToken) {
    payload.managementToken = managementToken;
  }

  return payload;
}
