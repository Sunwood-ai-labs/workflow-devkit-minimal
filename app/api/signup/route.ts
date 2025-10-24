import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

type DemoStore = {
  users: Map<
    string,
    {
      id: string;
      email: string;
      createdAt: string;
      enrichment?: EnrichmentPayload;
      checkInAt?: string;
    }
  >;
};

type EnrichmentPayload = {
  fullName: string;
  headline: string;
  location: string;
  avatar: string;
  source: string;
};

type DemoEvent =
  | { type: "error"; message: string }
  | { type: "started"; email: string; startedAt: string }
  | {
      type: "profile-created";
      persisted: boolean;
      user: { id: string; email: string; createdAt: string };
    }
  | {
      type: "profile-enriched";
      payload: EnrichmentPayload;
    }
  | {
      type: "welcome-email";
      attempt: number;
      status: "retrying" | "success";
      message: string;
      provider: string;
    }
  | {
      type: "scheduled-check-in";
      checkInAt: string;
    }
  | {
      type: "completed";
      message: string;
    };

const encoder = new TextEncoder();

const globalAny = globalThis as {
  __workflowDemoStore?: DemoStore;
};

function getStore(): DemoStore {
  if (!globalAny.__workflowDemoStore) {
    globalAny.__workflowDemoStore = {
      users: new Map(),
    };
  }
  return globalAny.__workflowDemoStore;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  const { email } = await request.json();

  if (typeof email !== "string" || email.trim().length === 0) {
    return NextResponse.json(
      { error: "Email is required" },
      {
        status: 400,
      }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  const stream = new ReadableStream({
    async start(controller) {
      const push = (event: DemoEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const startedAt = new Date().toISOString();
        push({ type: "started", email: normalizedEmail, startedAt });
        await delay(400);

        // Stage 1: Durable profile creation
        const store = getStore();
        const existing = store.users.get(normalizedEmail);
        const now = new Date();
        const userRecord =
          existing ??
          {
            id: randomUUID(),
            email: normalizedEmail,
            createdAt: now.toISOString(),
          };

        store.users.set(normalizedEmail, {
          ...userRecord,
        });

        push({
          type: "profile-created",
          persisted: Boolean(existing),
          user: {
            id: userRecord.id,
            email: userRecord.email,
            createdAt: userRecord.createdAt,
          },
        });

        await delay(750);

        // Stage 2: Observability via external enrichment
        let enrichment: EnrichmentPayload = {
          fullName: "Taylor Workflow",
          headline: "Automation Enthusiast",
          location: "Internet",
          avatar: "https://avatars.dicebear.com/api/identicon/workflow.svg",
          source: "fallback",
        };

        try {
          const response = await fetch("https://random-data-api.com/api/v2/users");
          if (response.ok) {
            const json = (await response.json()) as {
              first_name: string;
              last_name: string;
              employment: { title: string };
              address: { city: string; state: string };
              avatar: string;
            };
            enrichment = {
              fullName: `${json.first_name} ${json.last_name}`,
              headline: json.employment.title,
              location: `${json.address.city}, ${json.address.state}`,
              avatar: json.avatar,
              source: "random-data-api.com",
            };
          }
        } catch {
          // fall back to default enrichment
        }

        store.users.set(normalizedEmail, {
          ...store.users.get(normalizedEmail)!,
          enrichment,
        });

        push({
          type: "profile-enriched",
          payload: enrichment,
        });

        await delay(600);

        // Stage 3: Retryable welcome email
        push({
          type: "welcome-email",
          attempt: 1,
          status: "retrying",
          message: "Email provider rate-limited us. Retrying shortly…",
          provider: "Resend (simulated)",
        });

        await delay(900);

        push({
          type: "welcome-email",
          attempt: 2,
          status: "success",
          message: "Email delivered after automatic retry 🎯",
          provider: "Resend (simulated)",
        });

        await delay(500);

        // Stage 4: Durable scheduling
        const checkInAt = new Date(Date.now() + 45_000).toISOString();
        store.users.set(normalizedEmail, {
          ...store.users.get(normalizedEmail)!,
          checkInAt,
        });
        push({
          type: "scheduled-check-in",
          checkInAt,
        });

        await delay(300);

        push({
          type: "completed",
          message: `Reliability lab finished for ${normalizedEmail}`,
        });
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected error starting reliability lab.";
        push({ type: "error", message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
