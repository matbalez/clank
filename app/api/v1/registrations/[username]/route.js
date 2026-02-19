import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function GET(_request, { params }) {
  const username = (params.username || "").toLowerCase();

  const registration = await db.registration.findUnique({
    where: { username }
  });

  if (!registration) {
    return NextResponse.json(
      {
        error: "not_found"
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
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
    updatedAt: registration.updatedAt.toISOString()
  });
}
