import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { runAvailabilityFlow } from "@/lib/registration-service";

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const result = await runAvailabilityFlow({
    query: {
      username: searchParams.get("username") || ""
    },
    db
  });

  return NextResponse.json(result.payload, { status: result.status });
}
