# workflow-devkit-minimal

Vercel Workflow DevKit の「耐久性 / 観測性 / 自動リトライ / スケジューリング」を、1 つのストリーミング UI でライブ体験できるミニラボです。  
メールアドレスを送信すると、4 つのチェックポイントが順番に進み、各ステップの結果が即座に UI に流れてきます。

---

## 🚀 セットアップ

```bash
npm install
npm run dev
```

ブラウザを開いたままでも、ターミナルから直接ラボを回せます:

```bash
curl -X POST --json '{"email":"hello@example.com"}' http://localhost:3000/api/signup
```

---

## 🐳 Docker Compose

```bash
docker compose up --build
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開き、フォームまたは `curl` でワークフローを起動してください。

---

## 🔍 デモで体験できること

1. **Profile created（Reliability）**  
   durable storage にプロファイルを保存。既存レコードがあれば即座に復元される様子がログに流れます。
2. **Profile enrichment（Observability）**  
   ランダムユーザー API を呼び出し、取得した属性をそのまま UI に表示。外部依存のレスポンスを観測できます。
3. **Welcome email with retry（Reliability）**  
   1 回目は意図的に失敗 → `Retryable` の概念を模した自動リトライで成功するまでの過程を可視化。
4. **Scheduled check-in（Durability）**  
   `sleep` 相当の待機を設定し、残り時間のカウントダウン→タイマー満了時の自動復帰イベントまでをライブで確認できます。

これらのイベントは `text/event-stream` で逐次配信され、`app/page.tsx` がリアルタイムに描画を更新します。
実際の Workflow DevKit ではこの API ハンドラーを `start(handleXXXWorkflow, [...])` に差し替えるだけで、
同じ UI を“本物”のワークフロー監視ダッシュボードとして使えます。

---

## 📁 ディレクトリ構成

```
workflow-devkit-minimal/
├─ app/
│  ├─ layout.tsx
│  ├─ page.tsx                 # ストリーミング UI（React + hooks）
│  └─ api/
│     └─ signup/
│        └─ route.ts          # SSE で4ステップを順次配信する API
├─ docker-compose.yml
├─ Dockerfile
├─ next.config.mjs            # withWorkflow 設定
├─ package.json
├─ tsconfig.json
├─ next-env.d.ts
└─ README.md
```

---

## 📌 メモ

- 各イベントは SSE (`text/event-stream`) でブラウザへ送信されます。  
- 実際のプロダクションでは Vercel Workflow と組み合わせて、ここで示した 4 つの耐久パターンを拡張してください。
- GitHub へ push 後は `npm run dev` だけで動作確認できます。デモの安全性を保つため、一部の API はサンプルデータでフォールバックします。
