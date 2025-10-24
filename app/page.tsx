"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

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
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="hero-title">
        <header className={styles.header}>
          <h1 id="hero-title" className={styles.title}>
            Workflow DevKit Minimal Demo
          </h1>
          <p className={styles.subtitle}>
            Kick off the <code>handleUserSignup</code> workflow by submitting an
            email. Your workflow status will glow up in real time once things
            start rolling〜✨
          </p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="email">
            Email address
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="jane@example.com"
              className={styles.input}
              disabled={isSubmitting}
            />
          </label>
          <button
            type="submit"
            disabled={isSubmitting}
            className={styles.button}
            aria-live="polite"
          >
            {isSubmitting ? "Starting workflow…" : "Start workflow"}
          </button>
        </form>

        <div className={styles.statusContainer}>
          <StatusPanel status={status} formattedStartedAt={formattedStartedAt} />
        </div>

        <div className={styles.terminal}>
          <p className={styles.supportingText}>Try from the terminal:</p>
          <pre className={styles.terminalPre}>
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
  const statusClassName = {
    idle: `${styles.status} ${styles.statusIdle}`,
    sending: `${styles.status} ${styles.statusSending}`,
    error: `${styles.status} ${styles.statusError}`,
    success: `${styles.status} ${styles.statusSuccess}`,
  } as const;

  switch (status.state) {
    case "idle":
      return (
        <div className={statusClassName.idle}>
          Submit an email to kick things off — your workflow journey will pop up
          right here once it’s in motion💃
        </div>
      );

    case "sending":
      return (
        <div className={statusClassName.sending}>
          Starting workflow for <strong>{status.email}</strong>… hold tight,
          the automation glam squad is suiting up💅
        </div>
      );

    case "error":
      return (
        <div className={statusClassName.error}>
          <strong>Failed</strong>
          <span>{status.message}</span>
          <span>
            Email you tried: <code>{status.email}</code>
          </span>
        </div>
      );

    case "success":
      return (
        <div className={statusClassName.success}>
          <div>
            <p>
              Workflow queued for <strong>{status.email}</strong> 🎉
            </p>
            <p>{status.message}</p>
            <p>
              Started at: {formattedStartedAt || "just now"}
            </p>
            {status.runId && (
              <p>
                Run ID: <code>{status.runId}</code>
              </p>
            )}
          </div>
          <div className={styles.nextSteps}>
            <p className={styles.nextStepsTitle}>次のチェックポイント</p>
            <ol className={styles.nextStepsList}>
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
