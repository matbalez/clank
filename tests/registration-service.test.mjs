import test from "node:test";
import assert from "node:assert/strict";

import { runRegistrationFlow, runUpdateFlow } from "../lib/registration-service.js";

const CREATED_AT = new Date("2026-02-21T00:00:00.000Z");
const UPDATED_AT = new Date("2026-02-21T00:01:00.000Z");

function makeRegistration(overrides = {}) {
  return {
    id: "reg_123",
    username: "satoshi",
    bip321Uri: "bitcoin:bc1qexample",
    namespaceDomain: "clank.money",
    bip353RecordName: "satoshi.user._bitcoin-payment.clank.money",
    status: "PENDING_DNS",
    dnsProvider: null,
    dnsRecordId: null,
    dnsPublishedAt: null,
    dnsLastError: null,
    publishAttempts: 0,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides
  };
}

test("runRegistrationFlow creates and publishes a registration", async () => {
  const createCalls = [];
  const updateCalls = [];
  const publishCalls = [];
  const issueCalls = [];

  const created = makeRegistration({
    bip321Uri: "bitcoin:bc1qnewinstruction"
  });
  const activated = makeRegistration({
    status: "ACTIVE",
    dnsProvider: "cloudflare",
    dnsRecordId: "dns_123",
    dnsPublishedAt: UPDATED_AT,
    publishAttempts: 1,
    updatedAt: UPDATED_AT
  });

  const db = {
    registration: {
      create: async (args) => {
        createCalls.push(args);
        return created;
      },
      update: async (args) => {
        updateCalls.push(args);
        return activated;
      }
    }
  };

  const result = await runRegistrationFlow({
    body: {
      username: "Satoshi",
      bip321Uri: "bitcoin:bc1qnewinstruction"
    },
    namespaceDomain: "clank.money",
    db,
    publishPaymentInstructionTxt: async (args) => {
      publishCalls.push(args);
      return { provider: "cloudflare", recordId: "dns_123" };
    },
    issueManagementToken: (username) => {
      issueCalls.push(username);
      return `token-${username}`;
    }
  });

  assert.equal(result.status, 201);
  assert.equal(result.payload.username, "satoshi");
  assert.equal(result.payload.status, "ACTIVE");
  assert.equal(result.payload.managementToken, "token-satoshi");
  assert.equal(createCalls.length, 1);
  assert.equal(createCalls[0].data.username, "satoshi");
  assert.equal(publishCalls.length, 1);
  assert.equal(publishCalls[0].recordName, "satoshi.user._bitcoin-payment.clank.money");
  assert.equal(publishCalls[0].txtValue, "bitcoin:bc1qnewinstruction");
  assert.equal(updateCalls.length, 1);
  assert.deepEqual(issueCalls, ["satoshi"]);
});

test("runRegistrationFlow returns 409 when username already exists", async () => {
  const db = {
    registration: {
      create: async () => {
        const error = new Error("duplicate");
        error.code = "P2002";
        throw error;
      }
    }
  };

  const result = await runRegistrationFlow({
    body: {
      username: "satoshi",
      bip321Uri: "bitcoin:bc1qnewinstruction"
    },
    namespaceDomain: "clank.money",
    db,
    publishPaymentInstructionTxt: async () => ({ provider: "cloudflare", recordId: "dns_123" }),
    issueManagementToken: () => "unused"
  });

  assert.equal(result.status, 409);
  assert.equal(result.payload.error, "username_unavailable");
});

test("runRegistrationFlow returns DNS_FAILED when DNS publishing fails", async () => {
  const created = makeRegistration();
  const dnsFailed = makeRegistration({
    status: "DNS_FAILED",
    dnsLastError: "Cloudflare outage",
    publishAttempts: 1,
    updatedAt: UPDATED_AT
  });

  const db = {
    registration: {
      create: async () => created,
      update: async () => dnsFailed
    }
  };

  const result = await runRegistrationFlow({
    body: {
      username: "satoshi",
      bip321Uri: "bitcoin:bc1qnewinstruction"
    },
    namespaceDomain: "clank.money",
    db,
    publishPaymentInstructionTxt: async () => {
      throw new Error("Cloudflare outage");
    },
    issueManagementToken: () => "token-satoshi"
  });

  assert.equal(result.status, 202);
  assert.equal(result.payload.status, "DNS_FAILED");
  assert.equal(result.payload.managementToken, "token-satoshi");
});

test("runUpdateFlow updates record when token is valid", async () => {
  const updateCalls = [];
  const existing = makeRegistration({
    status: "ACTIVE",
    publishAttempts: 1
  });
  const updated = makeRegistration({
    bip321Uri: "bitcoin:bc1qupdated",
    status: "ACTIVE",
    dnsProvider: "cloudflare",
    dnsRecordId: "dns_456",
    dnsPublishedAt: UPDATED_AT,
    publishAttempts: 2,
    updatedAt: UPDATED_AT
  });

  const db = {
    registration: {
      findUnique: async () => existing,
      update: async (args) => {
        updateCalls.push(args);
        return updated;
      }
    }
  };

  const result = await runUpdateFlow({
    username: "satoshi",
    body: { bip321Uri: "bitcoin:bc1qupdated" },
    authorizationHeader: "Bearer token",
    db,
    publishPaymentInstructionTxt: async () => ({ provider: "cloudflare", recordId: "dns_456" }),
    assertManagementTokenConfigured: () => {},
    extractBearerToken: () => "token",
    verifyManagementToken: () => ({ sub: "satoshi", scope: "registration:update" })
  });

  assert.equal(result.status, 200);
  assert.equal(result.payload.bip321Uri, "bitcoin:bc1qupdated");
  assert.equal(result.payload.status, "ACTIVE");
  assert.equal(updateCalls.length, 1);
});

test("runUpdateFlow requires bearer token", async () => {
  const result = await runUpdateFlow({
    username: "satoshi",
    body: { bip321Uri: "bitcoin:bc1qupdated" },
    authorizationHeader: null,
    db: {
      registration: {
        findUnique: async () => null,
        update: async () => null
      }
    },
    publishPaymentInstructionTxt: async () => ({ provider: "cloudflare", recordId: "dns_456" }),
    assertManagementTokenConfigured: () => {},
    extractBearerToken: () => null,
    verifyManagementToken: () => ({ sub: "satoshi" })
  });

  assert.equal(result.status, 401);
  assert.equal(result.payload.error, "authorization_required");
});

test("runUpdateFlow rejects tokens for different username", async () => {
  const result = await runUpdateFlow({
    username: "satoshi",
    body: { bip321Uri: "bitcoin:bc1qupdated" },
    authorizationHeader: "Bearer token",
    db: {
      registration: {
        findUnique: async () => null,
        update: async () => null
      }
    },
    publishPaymentInstructionTxt: async () => ({ provider: "cloudflare", recordId: "dns_456" }),
    assertManagementTokenConfigured: () => {},
    extractBearerToken: () => "token",
    verifyManagementToken: () => ({ sub: "alice" })
  });

  assert.equal(result.status, 403);
  assert.equal(result.payload.error, "token_username_mismatch");
});

test("runUpdateFlow returns 404 when registration does not exist", async () => {
  const result = await runUpdateFlow({
    username: "satoshi",
    body: { bip321Uri: "bitcoin:bc1qupdated" },
    authorizationHeader: "Bearer token",
    db: {
      registration: {
        findUnique: async () => null,
        update: async () => null
      }
    },
    publishPaymentInstructionTxt: async () => ({ provider: "cloudflare", recordId: "dns_456" }),
    assertManagementTokenConfigured: () => {},
    extractBearerToken: () => "token",
    verifyManagementToken: () => ({ sub: "satoshi" })
  });

  assert.equal(result.status, 404);
  assert.equal(result.payload.error, "not_found");
});
