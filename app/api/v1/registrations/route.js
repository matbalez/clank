import { NextResponse } from "next/server";
import { withPayment } from "@moneydevkit/nextjs/server";

import { registrationSchema, buildBip353RecordName } from "@/lib/ama";
import { db } from "@/lib/db";
import { publishPaymentInstructionTxt } from "@/lib/dns-publisher";
import { buildRegistrationPaymentConfig } from "@/lib/mdk402";

async function createRegistrationHandler(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parseResult = registrationSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        details: parseResult.error.flatten()
      },
      { status: 400 }
    );
  }

  const namespaceDomain = process.env.AMA_NAMESPACE_DOMAIN;
  if (!namespaceDomain) {
    return NextResponse.json(
      {
        error: "misconfigured",
        details: "AMA_NAMESPACE_DOMAIN is required"
      },
      { status: 500 }
    );
  }

  const { username, bip321Uri } = parseResult.data;

  try {
    const created = await db.registration.create({
      data: {
        username,
        bip321Uri,
        namespaceDomain,
        bip353RecordName: buildBip353RecordName(username, namespaceDomain),
        status: "PENDING_DNS"
      }
    });

    const publishResult = await publishRegistrationDns(created);

    return NextResponse.json(
      {
        id: publishResult.id,
        username: publishResult.username,
        bip321Uri: publishResult.bip321Uri,
        namespaceDomain: publishResult.namespaceDomain,
        bip353RecordName: publishResult.bip353RecordName,
        txtValue: publishResult.bip321Uri,
        status: publishResult.status,
        dnsProvider: publishResult.dnsProvider,
        dnsRecordId: publishResult.dnsRecordId,
        dnsPublishedAt: publishResult.dnsPublishedAt?.toISOString() || null,
        dnsLastError: publishResult.dnsLastError || null,
        publishAttempts: publishResult.publishAttempts,
        createdAt: publishResult.createdAt.toISOString()
      },
      { status: publishResult.status === "ACTIVE" ? 201 : 202 }
    );
  } catch (error) {
    if (error.code === "P2002") {
      return NextResponse.json(
        {
          error: "username_unavailable",
          details: "username is already registered"
        },
        { status: 409 }
      );
    }

    throw error;
  }
}

async function publishRegistrationDns(registration) {
  try {
    const dnsResult = await publishPaymentInstructionTxt({
      recordName: registration.bip353RecordName,
      txtValue: registration.bip321Uri
    });

    return db.registration.update({
      where: { id: registration.id },
      data: {
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
        status: "DNS_FAILED",
        dnsLastError: message.slice(0, 500),
        publishAttempts: {
          increment: 1
        }
      }
    });
  }
}

export const POST = withPayment(buildRegistrationPaymentConfig(), createRegistrationHandler);
