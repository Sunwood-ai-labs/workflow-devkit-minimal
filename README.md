# workflow-devkit-minimal

Vercel Workflow DevKit を Next.js で試せる最小構成テンプレートです。  
ローカルや Docker Compose から `handleWorkflowShowcase` ワークフローを実行できます。

---

## 🚀 セットアップ

```bash
npm install
npm run dev
```

別ターミナルからワークフローを起動:

```bash
curl -X POST --json '{"email":"hello@example.com"}' http://localhost:3000/api/signup
```

実行状況の確認:

```bash
npx workflow inspect runs         # CLI
npx workflow inspect runs --web   # Web UI
```

---

## 🐳 Docker Compose

```bash
docker compose up --build
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開き、フォームまたは `curl` でワークフローを起動してください。

---

## 🧠 ワークフロー構成

- `workflows/user-signup.ts` に `handleWorkflowShowcase` ワークフローを実装。  
- `"use workflow"` と `"use step"` が状態を耐久化し、決定的リプレイ・自動リトライを提供。  
- `RetryableError` で外部サービスの揺らぎを吸収、`sleep` で長時間の待機を安全にスケジュール。  
- レスポンスのストーリーボードが UI に表示され、DevKit が担う役割を即座に把握できます。

API エンドポイント `app/api/signup/route.ts` で `start(handleWorkflowShowcase, [email])` を呼び出し、ワークフローを起動します。

---

## 📁 ディレクトリ構成

```
workflow-devkit-minimal/
├─ app/
│  ├─ layout.tsx
│  ├─ page.tsx
│  └─ api/
│     └─ signup/
│        └─ route.ts          # ワークフロー起動 API
├─ workflows/
│  └─ user-signup.ts          # ワークフロー定義
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

- `npx workflow inspect runs` で CLI による可視化。  
- `npx workflow inspect runs --web` で Web UI を起動。  
- GitHub へ push 後は `npm run dev` だけで動作確認できます。

拡張テンプレート（Hook や AI Agent 連携など）が必要な場合は、お気軽にどうぞ！
