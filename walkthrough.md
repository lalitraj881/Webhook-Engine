# Webhook Automation Engine — Walkthrough

I have successfully completed all the requirements from the Debales AI engineering brief. The implementation is robust, production-ready, and fully containerized.

Here is a summary of what has been built and how to test it.

## ✅ Completed Requirements

### 1. Reliable Ingestion (NestJS)
- **Fast ACK**: The webhook controller (`POST /webhooks/:tenantId/:source`) returns an immediate 200 OK after pushing to Redis/BullMQ.
- **Spoof Protection**: A custom `SignatureGuard` uses `crypto.timingSafeEqual` to verify HMAC-SHA256 signatures against each tenant's unique secret.
- **Deduplication**: The `IdempotencyInterceptor` uses a blazing-fast Redis `SETNX` lock (with a 24h TTL) to ensure exactly-once processing. A MongoDB unique index serves as a secondary safety net.

### 2. Async Pipeline (BullMQ & Redis)
- **Two-Queue Architecture**: 
  - `webhook-processing`: Evaluates rules (fast).
  - `action-dispatch`: Executes HTTP calls/emails (slower).
- **Crash Recovery**: BullMQ is configured with `stalledInterval` and `lockDuration`. If a worker crashes mid-job, BullMQ automatically detects the stalled lock and re-enqueues it.

### 3. Rule Engine
- **Operators**: Implemented 5 operators (`equals`, `not_equals`, `greater_than`, `less_than`, `contains`, `exists`) using dot-notation field access.
- **Actions**: Implemented three actions: Webhook (HTTP POST), Email (mocked), and Log.

### 4. Visibility & Recovery
- **Full History**: Every execution attempt, including failures and network timeouts, is logged inside the `JobHistory` document.
- **Replay Mechanism**: The frontend allows replaying any failed job. A replay creates a new job history entry linked to the original, using the exact original `eventPayload`.

### 5. Multi-Tenant Isolation
- **Server-Side Enforcement**: `TenantGuard` and `TenantMiddleware` secure the API. The `CurrentTenant` decorator guarantees every database query is scoped to the requesting tenant.

### 6. Read-Only UI (React + Vite)
- A clean, modern dashboard built with React and Vite. It polls the API every 2 seconds for live updates, showing overall stats, webhook events, job history, and automation rules.

---

## 🚀 How to Run and Verify

> [!IMPORTANT]
> The entire stack is containerized. You just need Docker installed.

### 1. Start the Stack

Open your terminal in the `h:\Webhook Engine` directory and run:

```bash
docker-compose up -d --build
```

This starts:
- MongoDB (port 27017)
- Redis (port 6379)
- Backend (NestJS on port 3000)
- Frontend (React on port 5173)

The backend will automatically seed **two demo tenants** (Acme Corp and Beta Store) along with test automation rules.

### 2. View the UI

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### 3. Run the Test Scripts

We've provided scripts to easily simulate webhooks and demonstrate the core capabilities:

**Test Happy Path**
*(Requires Git Bash or WSL on Windows)*
```bash
./scripts/send-webhook.sh <TENANT_A_ID>
```

**Test Deduplication**
```bash
./scripts/send-duplicate.sh <TENANT_A_ID>
```

**Test Failure & Replay**
```bash
./scripts/trigger-failure.sh <TENANT_B_ID>
```
*Wait for it to fail, then use the "Replay This Job" button in the UI!*

*(Note: You can find the Tenant IDs in the UI's top-right dropdown selector).*

---

## 📄 The Scaling Question

The `README.md` file contains a detailed, 1-page write-up addressing the scaling question (1.5M events/day). It analyzes the bottlenecks (action network latency vs ingestion speed) and proposes concrete solutions (Worker scaling, Circuit Breakers, MongoDB batch inserts).

## 🎥 Ready for the Loom Recording

You are now fully ready to record your Loom video! You can walk through:
1. Sending a webhook and showing the fast ACK in the terminal.
2. Showing the completed job in the UI.
3. Sending the exact same webhook again (using `send-duplicate.sh`) and showing the system reject it.
4. Sending the failure webhook (`trigger-failure.sh`), showing the UI update with the error, and clicking Replay.
5. Highlighting the `IdempotencyInterceptor` code as your proudest design decision.
