"use client";

import { useMemo, useState } from "react";

type WorkflowStatus =
  | { state: "idle" }
  | { state: "sending"; email: string }
  | {
      state: "success";
      email: string;
      message: string;
      runId?: string;
      startedAt: string;
    }
  | { state: "error"; message: string; email: string };

export default function Home() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<WorkflowStatus>({ state: "idle" });

  const isSubmitting = status.state === "sending";

  const formattedStartedAt = useMemo(() => {
    if (status.state !== "success") return "";
    const date = new Date(status.startedAt);
    return date.toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [status]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const submittedEmail = email.trim();
    if (!submittedEmail) return;

    setStatus({ state: "sending", email: submittedEmail });

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: submittedEmail }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();

      setStatus({
        state: "success",
        email: submittedEmail,
        message:
          typeof data.message === "string"
            ? data.message
            : `Workflow started for ${submittedEmail}`,
        runId: typeof data.runId === "string" ? data.runId : undefined,
        startedAt: new Date().toISOString(),
      });
      setEmail("");
    } catch (error) {
      setStatus({
        state: "error",
        message:
          error instanceof Error
            ? `Workflow start failed: ${error.message}`
            : "Workflow start failed due to an unknown error.",
        email: submittedEmail,
      });
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        background: "#f5f5f5",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 12px 24px rgba(0, 0, 0, 0.08)",
          padding: "2.25rem",
          display: "grid",
          gap: "1.75rem",
        }}
      >
        <header>
          <h1 style={{ marginBottom: "0.5rem" }}>
            Workflow DevKit Minimal Demo
          </h1>
          <p style={{ marginBottom: "0", color: "#555" }}>
            Kick off the <code>handleUserSignup</code> workflow by submitting an
            email address. Progress will appear below once the workflow starts.
          </p>
        </header>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
          <label style={{ display: "grid", gap: "0.5rem" }}>
            <span>Email address</span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="jane@example.com"
              style={{
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid #ccc",
              }}
              disabled={isSubmitting}
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              background: "#111827",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 600,
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? "Starting workflow…" : "Start workflow"}
          </button>
        </form>

        <StatusPanel status={status} formattedStartedAt={formattedStartedAt} />

        <div style={{ color: "#555", fontSize: "0.9rem" }}>
          <p style={{ marginBottom: "0.5rem" }}>Try from the terminal:</p>
          <pre
            style={{
              background: "#111827",
              color: "#f3f4f6",
              borderRadius: "8px",
              padding: "1rem",
              overflowX: "auto",
            }}
          >
{`curl -X POST --json '{"email":"demo@example.com"}' http://localhost:3000/api/signup`}
          </pre>
        </div>
      </section>
    </main>
  );
}

function StatusPanel({
  status,
  formattedStartedAt,
}: {
  status: WorkflowStatus;
  formattedStartedAt: string;
}) {
  switch (status.state) {
    case "idle":
      return (
        <div
          style={{
            padding: "1rem",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            color: "#4b5563",
          }}
        >
          Submit an email to start the workflow; progress will appear here.
        </div>
      );

    case "sending":
      return (
        <div
          style={{
            padding: "1rem",
            borderRadius: "8px",
            border: "1px solid #c4b5fd",
            background: "#ede9fe",
            color: "#4338ca",
          }}
        >
          Starting workflow for <strong>{status.email}</strong>…
        </div>
      );

    case "error":
      return (
        <div
          style={{
            padding: "1rem",
            borderRadius: "8px",
            border: "1px solid #fca5a5",
            background: "#fee2e2",
            color: "#b91c1c",
            display: "grid",
            gap: "0.35rem",
          }}
        >
          <strong>Failed</strong>
          <span>{status.message}</span>
          <span style={{ fontSize: "0.85rem" }}>
            Email you tried: <code>{status.email}</code>
          </span>
        </div>
      );

    case "success":
      return (
        <div
          style={{
            padding: "1.25rem",
            borderRadius: "12px",
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            color: "#166534",
            display: "grid",
            gap: "0.75rem",
          }}
        >
          <div>
            <p style={{ fontWeight: 600, margin: 0 }}>
              Workflow queued for <strong>{status.email}</strong> 🎉
            </p>
            <p style={{ margin: "0.35rem 0", color: "#15803d" }}>
              {status.message}
            </p>
            <p style={{ margin: 0, fontSize: "0.85rem" }}>
              Started at: {formattedStartedAt || "just now"}
            </p>
            {status.runId && (
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
                Run ID: <code>{status.runId}</code>
              </p>
            )}
          </div>
          <div
            style={{
              borderTop: "1px solid #bbf7d0",
              paddingTop: "0.75rem",
              display: "grid",
              gap: "0.5rem",
            }}
          >
            <p style={{ margin: 0, fontWeight: 600 }}>次のチェックポイント</p>
            <ol
              style={{
                margin: 0,
                paddingLeft: "1.25rem",
                color: "#166534",
                display: "grid",
                gap: "0.35rem",
              }}
            >
              <li>Welcome → Onboarding の順にメール送信ステップが進みます。</li>
              <li>
                進捗は `npx workflow inspect runs`
                で確認できます。Web UI は `--web` を追加。
              </li>
              <li>
                Docker のログにステップごとのリトライと完了状況が出力されます。
              </li>
            </ol>
          </div>
        </div>
      );
  }
}
