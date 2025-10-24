import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { handleUserSignup } from "@/workflows/user-signup";

export async function POST(request: Request) {
  const { email } = await request.json();

  if (typeof email !== "string" || email.length === 0) {
    return NextResponse.json(
      { error: "Email is required" },
      {
        status: 400,
      }
    );
  }

  await start(handleUserSignup, [email]);

  return NextResponse.json({
    message: `Workflow started for ${email}`,
  });
}
