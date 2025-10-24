import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { handleWorkflowShowcase } from "@/workflows/user-signup";

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

  const run = await start(handleWorkflowShowcase, [email]);

  return NextResponse.json({
    message: `Reliability lab started for ${email}`,
    runId: typeof run?.id === "string" ? run.id : undefined,
    storyboard: [
      {
        title: "Profile created",
        description:
          "Workflow DevKit persists state between steps, so your user record is safe even if infrastructure wiggles.",
        badge: "reliability",
      },
      {
        title: "Profile enrichment",
        description:
          "Use `use step` to call external APIs without losing context—Vercel replays the execution deterministically when needed.",
        badge: "observability",
      },
      {
        title: "Welcome email with retry",
        description:
          "Transient failures trigger automatic retries via `RetryableError`, keeping integrations resilient out of the box.",
        badge: "reliability",
      },
      {
        title: "Scheduled check-in",
        description:
          "Long waits park the workflow (`sleep`) without burning compute. The engine resumes right on time, even across deploys.",
        badge: "durability",
      },
    ],
  });
}
