import { randomUUID } from "crypto";
import { RetryableError, sleep } from "workflow";

type TimelineEvent = {
  title: string;
  summary: string;
  detail: string;
  badge: "reliability" | "durability" | "observability";
};

declare global {
  // eslint-disable-next-line no-var
  var __workflowDemoAttempts: Map<string, number> | undefined;
}

export async function handleWorkflowShowcase(email: string) {
  "use workflow";

  const timeline: TimelineEvent[] = [];

  const user = await createUser(email);
  timeline.push({
    title: "Profile created",
    summary: "User record stored durably",
    detail: `User ${user.id.slice(0, 8)} is ready for enrichment.`,
    badge: "reliability",
  });

  const enrichment = await enrichProfile(user);
  timeline.push({
    title: "Profile enriched",
    summary: "Fetched preferences & plan alignment",
    detail: `Preferred plan: ${enrichment.planTier}, journey: ${enrichment.journey}`,
    badge: "observability",
  });

  const emailResult = await sendWelcomeEmail(user.email);
  timeline.push({
    title: "Welcome email delivered",
    summary: "Automatic retry smoothed over a flaky provider",
    detail: `Attempts: ${emailResult.attempts}, provider: ${emailResult.provider}`,
    badge: "reliability",
  });

  const checkIn = await scheduleCheckIn(user.email);
  timeline.push({
    title: "Check-in scheduled",
    summary: "Workflow parked without hogging compute",
    detail: `Follow-up planned for ${new Date(checkIn.checkInAt).toLocaleString()}.`,
    badge: "durability",
  });

  return {
    userId: user.id,
    status: "orchestrating",
    timeline,
    checkInAt: checkIn.checkInAt,
  };
}

async function createUser(email: string) {
  "use step";

  console.log(`[workflow-demo] creating user ${email}`);
  return { id: randomUUID(), email };
}

async function enrichProfile(user: { id: string; email: string }) {
  "use step";

  console.log(`[workflow-demo] enriching profile ${user.id}`);
  await sleep("2s");
  return { planTier: "Pro", journey: "AI onboarding" };
}

async function sendWelcomeEmail(email: string) {
  "use step";

  const key = `sendWelcome:${email}`;
  const store: Map<string, number> =
    globalThis.__workflowDemoAttempts ?? (globalThis.__workflowDemoAttempts = new Map());

  const attempts = store.get(key) ?? 0;

  if (attempts < 1) {
    store.set(key, attempts + 1);
    console.log(`[workflow-demo] welcome email transient failure for ${email}`);
    throw new RetryableError("Email provider rate-limited us, retrying soon.", {
      retryAfter: 1,
    });
  }

  store.delete(key);
  console.log(`[workflow-demo] welcome email sent to ${email} after ${attempts + 1} attempts`);
  return { attempts: attempts + 1, provider: "Resend" };
}

async function scheduleCheckIn(email: string) {
  "use step";

  console.log(`[workflow-demo] scheduling check-in for ${email}`);
  await sleep("3s");
  return { checkInAt: new Date(Date.now() + 3_000).toISOString() };
}
