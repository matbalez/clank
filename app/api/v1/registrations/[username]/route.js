import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { publishPaymentInstructionTxt } from "@/lib/dns-publisher";
import {
  assertManagementTokenConfigured,
  extractBearerToken,
  verifyManagementToken
} from "@/lib/management-token";
import { formatRegistrationResponse, runUpdateFlow } from "@/lib/registration-service";

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

  return NextResponse.json(formatRegistrationResponse(registration));
}

export async function PATCH(request, { params }) {
  const username = (params.username || "").toLowerCase();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await runUpdateFlow({
    username,
    body,
    authorizationHeader: request.headers.get("authorization"),
    db,
    publishPaymentInstructionTxt,
    assertManagementTokenConfigured,
    extractBearerToken,
    verifyManagementToken
  });

  return NextResponse.json(result.payload, { status: result.status });
}
