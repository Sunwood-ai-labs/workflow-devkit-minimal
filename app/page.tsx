"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

type StageBadge = "reliability" | "observability" | "durability";
type StageStatus = "pending" | "active" | "success" | "error";
type StageId = "profile" | "enrichment" | "email" | "checkin";

type StageState = {
  id: StageId;
  title: string;
  description: string;
  badge: StageBadge;
  status: StageStatus;
  log?: string;
  data?: Record<string, unknown>;
  error?: string;
  attempts?: number;
};

type RunPhase = "idle" | "connecting" | "running" | "success" | "error";

type RunState =
  | { phase: "idle" }
  | { phase: "connecting"; email: string }
  | { phase: "running"; email: string; startedAt: string; message: string }
  | { phase: "success"; email: string; message: string; startedAt: string }
  | { phase: "error"; email: string; message: string };

type StreamEvent =
  | { type: "started"; email: string; startedAt: string }
  | {
      type: "profile-created";
      persisted: boolean;
      user: { id: string; email: string; createdAt: string };
    }
  | {
      type: "profile-enriched";
      payload: {
        fullName: string;
        headline: string;
        location: string;
        avatar: string;
        source: string;
      };
    }
  | {
      type: "welcome-email";
      attempt: number;
      status: "retrying" | "success";
      message: string;
      provider: string;
    }
  | { type: "scheduled-check-in"; checkInAt: string }
  | { type: "completed"; message: string }
  | { type: "error"; message: string };

const stageBlueprint: StageState[] = [
  {
    id: "profile",
    title: "Profile created",
    badge: "reliability",
    description: "ステップ間の状態が失われないことを、実データの保存で体感しよう。",
    status: "pending",
  },
  {
    id: "enrichment",
    title: "Profile enrichment",
    badge: "observability",
    description: "外部APIからのレスポンスをリプレイ可能な形で取り込み。中身をその場で確認！",
    status: "pending",
  },
  {
    id: "email",
    title: "Welcome email with retry",
    badge: "reliability",
    description: "1回目はわざと失敗→自動リトライで復旧する様子をライブでチェック。",
    status: "pending",
  },
  {
    id: "checkin",
    title: "Scheduled check-in",
    badge: "durability",
    description: "タイマーをセットして休眠。時間が来ても状態が維持されることをカウントダウンで確認！",
    status: "pending",
  },
];

function createInitialStages(): StageState[] {
  return stageBlueprint.map((stage) => ({ ...stage }));
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [runState, setRunState] = useState<RunState>({ phase: "idle" });
  const [stages, setStages] = useState<StageState[]>(createInitialStages);
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);
  const [checkInAt, setCheckInAt] = useState<string | null>(null);
  const [consoleLog, setConsoleLog] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!checkInAt) {
      setTimeLeftMs(null);
      return;
    }
    const target = new Date(checkInAt).getTime();

    const update = () => {
      const delta = target - Date.now();
      setTimeLeftMs(delta > 0 ? delta : 0);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [checkInAt]);

  const isBusy = runState.phase === "connecting" || runState.phase === "running";

  const formattedStartedAt = useMemo(() => {
    if (runState.phase !== "running" && runState.phase !== "success") return "";
    const date = new Date(runState.startedAt);
    return date.toLocaleString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [runState]);

  const updateStage = (id: StageId, updates: Partial<StageState>) => {
    setStages((prev) =>
      prev.map((stage) => (stage.id === id ? { ...stage, ...updates } : stage))
    );
  };

  const appendLog = (entry: string) => {
    setConsoleLog((prev) => [entry, ...prev].slice(0, 6));
  };

  const resetDemo = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStages(createInitialStages());
    setConsoleLog([]);
    setCheckInAt(null);
    setTimeLeftMs(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || isBusy) return;

    resetDemo();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunState({ phase: "connecting", email: trimmedEmail });

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(await response.text());
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      setRunState({
        phase: "running",
        email: trimmedEmail,
        startedAt: new Date().toISOString(),
        message: "Reliability lab started…",
      });

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const rawEvent = buffer.slice(0, boundary).trim();
          buffer = buffer.slice(boundary + 2);
          processEvent(rawEvent);
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      if (
        (error instanceof DOMException && error.name === "AbortError") ||
        (typeof error === "object" &&
          error !== null &&
          "name" in error &&
          (error as { name: string }).name === "AbortError")
      ) {
        return;
      }
      const message =
        error instanceof Error ? error.message : "unexpected error while streaming events";
      setRunState({
        phase: "error",
        email: trimmedEmail,
        message: `デモの開始に失敗: ${message}`,
      });
      updateStage("profile", { status: "error", error: message });
    } finally {
      abortRef.current = null;
    }
  };

  const processEvent = (rawEvent: string) => {
    if (!rawEvent) return;
    const dataLine = rawEvent
      .split("\n")
      .find((line) => line.startsWith("data:"));
    if (!dataLine) return;

    try {
      const event = JSON.parse(dataLine.replace(/^data:\s*/, "")) as StreamEvent;
      handleEvent(event);
    } catch (error) {
      appendLog(`⚠️ イベントの解析に失敗: ${String(error)}`);
    }
  };

  const handleEvent = (event: StreamEvent) => {
    switch (event.type) {
      case "started":
        setRunState({
          phase: "running",
          email: event.email,
          startedAt: event.startedAt,
          message: "Reliability lab started…",
        });
        appendLog(`🚀 ラボ開始: ${event.email}`);
        break;

      case "profile-created":
        updateStage("profile", {
          status: "success",
          log: event.persisted
            ? "既存のレコードを復元。途中で落ちても状態は保持されます。"
            : "新しいユーザープロファイルを保存しました。",
          data: {
            userId: event.user.id,
            createdAt: event.user.createdAt,
            persisted: event.persisted,
          },
        });
        appendLog("📦 プロファイルを保存（durable storage）");
        break;

      case "profile-enriched":
        updateStage("enrichment", {
          status: "success",
          log: `${event.payload.source} から取得した属性を適用しました。`,
          data: event.payload,
        });
        appendLog("🛰️ 外部APIからプロフィールを拡張");
        break;

      case "welcome-email":
        if (event.status === "retrying") {
          updateStage("email", {
            status: "active",
            log: event.message,
            attempts: event.attempt,
            data: {
              provider: event.provider,
            },
          });
          appendLog(`⏳ メール送信失敗 → リトライ待機 (試行 ${event.attempt})`);
        } else {
          updateStage("email", {
            status: "success",
            log: event.message,
            attempts: event.attempt,
            data: {
              provider: event.provider,
            },
          });
          appendLog(`✅ メール送信成功 (試行 ${event.attempt})`);
        }
        break;

      case "scheduled-check-in":
        updateStage("checkin", {
          status: "success",
          log: "必要になるまで休眠。時間が来たら自動で再開します！",
          data: {
            checkInAt: event.checkInAt,
          },
        });
        setCheckInAt(event.checkInAt);
        appendLog("⏰ 次のチェックインをスケジュール");
        break;

      case "completed":
        setRunState((prev) =>
          prev.phase === "running"
            ? { ...prev, phase: "success", message: event.message }
            : prev
        );
        appendLog("🎉 ラボ完了！");
        break;

      case "error":
        setRunState((prev) => {
          if (prev.phase === "running" || prev.phase === "connecting") {
            return { phase: "error", email: prev.email, message: event.message };
          }
          return prev;
        });
        updateStage("profile", { status: "error", error: event.message });
        appendLog(`❌ エラー: ${event.message}`);
        break;
    }
  };

  const countdownLabel = useMemo(() => {
    if (timeLeftMs === null) return null;
    const seconds = Math.max(0, Math.floor(timeLeftMs / 1000));
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}:${rest.toString().padStart(2, "0")}`;
  }, [timeLeftMs]);

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="hero-title">
        <header className={styles.header}>
          <h1 id="hero-title" className={styles.title}>
            Workflow Reliability Lab
          </h1>
          <p className={styles.subtitle}>
            メールアドレスを送信して、耐久性・観測性・自動リトライ・スケジューリングの４つの魔法をライブで体験しよう！
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
              disabled={isBusy}
            />
          </label>
          <button type="submit" className={styles.button} disabled={isBusy}>
            {isBusy ? "Running…" : "Start workflow"}
          </button>
        </form>

        <div className={styles.statusContainer}>
          <StatusPanel runState={runState} formattedStartedAt={formattedStartedAt} />
        </div>

        <StageList stages={stages} countdownLabel={countdownLabel} />

        <ConsoleLog entries={consoleLog} />

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
  runState,
  formattedStartedAt,
}: {
  runState: RunState;
  formattedStartedAt: string;
}) {
  const statusClassName = {
    idle: `${styles.status} ${styles.statusIdle}`,
    connecting: `${styles.status} ${styles.statusSending}`,
    running: `${styles.status} ${styles.statusSending}`,
    success: `${styles.status} ${styles.statusSuccess}`,
    error: `${styles.status} ${styles.statusError}`,
  } as const;

  switch (runState.phase) {
    case "idle":
      return (
        <div className={statusClassName.idle}>
          Submit an email to start the lab — the timeline will update step by step💃
        </div>
      );
    case "connecting":
      return (
        <div className={statusClassName.connecting}>
          Launching reliability lab for <strong>{runState.email}</strong>…
        </div>
      );
    case "running":
      return (
        <div className={statusClassName.running}>
          <p>
            Lab running for <strong>{runState.email}</strong> 💡
          </p>
          <p>{runState.message}</p>
          <p>Started at: {formattedStartedAt || "just now"}</p>
        </div>
      );
    case "success":
      return (
        <div className={statusClassName.success}>
          <p>
            Lab completed for <strong>{runState.email}</strong> 🎉
          </p>
          <p>{runState.message}</p>
          <p>Started at: {formattedStartedAt || "just now"}</p>
        </div>
      );
    case "error":
      return (
        <div className={statusClassName.error}>
          <strong>Lab failed</strong>
          <span>{runState.message}</span>
          <span>
            Email you tried: <code>{runState.email}</code>
          </span>
        </div>
      );
  }
}

function StageList({
  stages,
  countdownLabel,
}: {
  stages: StageState[];
  countdownLabel: string | null;
}) {
  return (
    <section className={styles.stageSection} aria-live="polite" aria-label="Workflow timeline">
      <ol className={styles.stageList}>
        {stages.map((stage) => (
          <li key={stage.id} className={`${styles.stageItem} ${styles[`stage-${stage.status}`]}`}>
            <header className={styles.stageHeader}>
              <div className={styles.stageMeta}>
                <span className={`${styles.badge} ${styles[`badge-${stage.badge}`]}`}>
                  {stage.badge}
                </span>
                <h3>{stage.title}</h3>
              </div>
              <StatusPill status={stage.status} />
            </header>
            <p className={styles.stageDescription}>{stage.description}</p>
            <StageContent stage={stage} countdownLabel={countdownLabel} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function StageContent({
  stage,
  countdownLabel,
}: {
  stage: StageState;
  countdownLabel: string | null;
}) {
  if (stage.status === "pending") {
    return null;
  }

  return (
    <div className={styles.stageBody}>
      {stage.data && stage.id === "profile" && (
        <dl className={styles.dataGrid}>
          <div>
            <dt>User ID</dt>
            <dd>{stage.data.userId as string}</dd>
          </div>
          <div>
            <dt>Created at</dt>
            <dd>{new Date(stage.data.createdAt as string).toLocaleString()}</dd>
          </div>
          <div>
            <dt>Restored?</dt>
            <dd>{(stage.data.persisted as boolean) ? "Yes — durable state" : "New record"}</dd>
          </div>
        </dl>
      )}

      {stage.data && stage.id === "enrichment" && (
        <div className={styles.enrichment}>
          <img
            src={(stage.data.avatar as string) ?? ""}
            alt="Profile avatar"
            className={styles.enrichmentAvatar}
          />
          <dl className={styles.dataGrid}>
            <div>
              <dt>Name</dt>
              <dd>{stage.data.fullName as string}</dd>
            </div>
            <div>
              <dt>Headline</dt>
              <dd>{stage.data.headline as string}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{stage.data.location as string}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{stage.data.source as string}</dd>
            </div>
          </dl>
        </div>
      )}

      {stage.id === "email" && (
        <dl className={styles.dataGrid}>
          {stage.attempts && (
            <div>
              <dt>Total attempts</dt>
              <dd>{stage.attempts}</dd>
            </div>
          )}
          {stage.data?.provider && (
            <div>
              <dt>Provider</dt>
              <dd>{stage.data.provider as string}</dd>
            </div>
          )}
        </dl>
      )}

      {stage.id === "checkin" && (
        <dl className={styles.dataGrid}>
          <div>
            <dt>Check-in at</dt>
            <dd>{new Date(stage.data?.checkInAt as string).toLocaleString()}</dd>
          </div>
          {countdownLabel && (
            <div>
              <dt>Next resume in</dt>
              <dd>{countdownLabel}</dd>
            </div>
          )}
        </dl>
      )}

      {stage.log && <p className={styles.stageLog}>{stage.log}</p>}
      {stage.error && <p className={styles.stageError}>{stage.error}</p>}
    </div>
  );
}

function StatusPill({ status }: { status: StageStatus }) {
  const label = {
    pending: "待機中",
    active: "リトライ中",
    success: "完了",
    error: "失敗",
  }[status];
  return <span className={`${styles.pill} ${styles[`pill-${status}`]}`}>{label}</span>;
}

function ConsoleLog({ entries }: { entries: string[] }) {
  if (entries.length === 0) return null;

  return (
    <section className={styles.consoleSection} aria-label="Recent events">
      <h2>Realtime log</h2>
      <ul className={styles.consoleList}>
        {entries.map((entry, index) => (
          <li key={`${entry}-${index}`}>{entry}</li>
        ))}
      </ul>
    </section>
  );
}
