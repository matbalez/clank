import { NextResponse } from "next/server";
import { withPayment } from "@moneydevkit/nextjs/server";

import { db } from "@/lib/db";
import { publishPaymentInstructionTxt } from "@/lib/dns-publisher";
import { issueManagementToken } from "@/lib/management-token";
import { buildRegistrationPaymentConfig } from "@/lib/mdk402";
import { runRegistrationFlow, runRegistrationPrecheck } from "@/lib/registration-service";

async function createRegistrationHandler(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const result = await runRegistrationFlow({
    body,
    namespaceDomain: process.env.CLANK_NAMESPACE_DOMAIN,
    db,
    publishPaymentInstructionTxt,
    issueManagementToken
  });

  return NextResponse.json(result.payload, { status: result.status });
}

const paidRegistrationHandler = withPayment(buildRegistrationPaymentConfig(), createRegistrationHandler);

export async function POST(request, context) {
  let body;

  try {
    body = await request.clone().json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const precheck = await runRegistrationPrecheck({
    body,
    namespaceDomain: process.env.CLANK_NAMESPACE_DOMAIN,
    db
  });

  if (precheck) {
    return NextResponse.json(precheck.payload, { status: precheck.status });
  }

  return paidRegistrationHandler(request, context);
}
