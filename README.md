# Debales AI — Async Webhook Automation Engine

A robust, multi-tenant webhook automation engine built with NestJS, BullMQ, Redis, and MongoDB. It reliably ingests webhooks, evaluates tenant-specific automation rules, and dispatches actions asynchronously.

## 🚀 Quick Start

Ensure you have Docker and Docker Compose installed.

```bash
# 1. Start the entire stack (MongoDB, Redis, Backend, Frontend)
docker-compose up -d --build

# 2. View logs if you want to see the system running
docker-compose logs -f backend

# 3. Open the Dashboard in your browser
# URL: http://localhost:5173
```

On first startup, the application will automatically run the seed script to create two demo tenants and their automation rules.

## 🧪 How to Simulate Webhooks & Failures

We provide convenient shell scripts to test the engine.

### 1. Happy Path (Shopify Order)
Sends a Shopify order that matches "Tenant A's" high-value order rule.
```bash
./scripts/send-webhook.sh <TENANT_A_ID>
# Note: You can copy the Tenant A ID from the dashboard or the backend startup logs.
```

### 2. Deduplication (Exactly-Once Processing)
Sends the exact same webhook payload twice. The second request will be rejected and acknowledged without creating a duplicate job.
```bash
./scripts/send-duplicate.sh <TENANT_A_ID>
```

### 3. Failure & Replay
Triggers a rule specifically designed to fail (makes an HTTP POST to an endpoint returning 500).
```bash
./scripts/trigger-failure.sh <TENANT_B_ID>
```
To replay this failure:
1. Open the UI at `http://localhost:5173`
2. Select **Tenant B** from the top right dropdown.
3. Go to the **Jobs** tab. Wait for the job to exhaust its 3 retries and enter the `failed` state.
4. Click **View Details**.
5. Click the **🔄 Replay This Job** button. You'll see a new job created with the exact same payload.

---

## 🏛️ Architecture & Data Model

### Data Model Justification

Our MongoDB schema is built around four primary collections, enforcing multi-tenancy at the query level:

1. **`tenants`**: Stores tenant config, including a unique `webhookSecret` for HMAC signature verification. This ensures one tenant cannot spoof events for another.
2. **`webhook_events`**: The raw ingestion log.
   - **Why store raw?** We need an audit trail *before* processing begins.
   - **Dedup Index:** We maintain a unique index on `idempotencyKey` as a secondary safety net to Redis.
3. **`automation_rules`**: The declarative rules engine.
   - Uses a document structure of `conditions` (field, operator, value) and `actions` (type, config).
4. **`job_history`**: The observability layer.
   - **Why attempts as an array?** By embedding `attempts` within the job document, a single query retrieves the full lifecycle of a job, making the UI blazing fast without complex JOINs (lookups).
   - Stores the `eventPayload` directly on the job to guarantee that if a replay happens weeks later, it executes against the *exact* data from that point in time, even if the raw event was purged.

### Queue Design (BullMQ)

We use a **Two-Queue Architecture**:
1. **`webhook-processing`**: Fast queue. Reads the event, evaluates rules.
2. **`action-dispatch`**: Slower queue. Actually makes the HTTP calls or sends emails.

**Why?** Independent scaling and fault isolation. A slow external API responding to our actions shouldn't cause a backlog in evaluating incoming webhooks.

**Crash Recovery & Failure Handling:**
- **Stalled Jobs:** If a worker crashes mid-execution (OOM, killed), BullMQ detects the stalled lock after `lockDuration` expires and automatically re-enqueues the job. *It does not silently disappear.*
- **Exponential Backoff:** Action failures are retried 3 times with exponential backoff (e.g., 5s, 15s, 45s) to avoid hammering failing external services.

---

## 📈 The Scaling Question

> **Scenario:** 500,000 orders/day × 3 webhooks = ~1,500,000 events/day from ONE tenant. Spikes of 10x during flash sales.

At ~1.5 million events per day, the steady-state load is roughly **17 events per second**. During a 10x flash sale spike, this jumps to **170 events per second**. 

Here is how the current design handles this, where it breaks first, and how I would evolve it.

### Phase 1: How the Current Design Handles 170 req/sec

The current single-node NestJS application handles this surprisingly well due to the architectural choices:

1. **Ingestion is ultra-lightweight:** The webhook controller does zero complex logic. It does an HMAC verification, an atomic Redis `SETNX` (O(1)), a single MongoDB insert, and a BullMQ enqueue (Redis write). A standard NestJS process on a decent container can handle 1,000+ req/sec of this workload. The 200 OK goes out immediately.
2. **Asynchronous pressure relief:** The spike to 170/sec hits the queue, not the worker. If the rule engine (processing queue) can only process 50/sec, the queue simply grows. No webhooks are dropped.
3. **Redis handles deduplication effortlessly:** Redis can easily sustain 100,000+ operations per second. 170 SETNX operations per second is rounding error.

### Phase 2: Where It Breaks First

The system will break in the **Processing and Dispatch layers**, specifically:

**Bottleneck 1: Action Dispatch Latency (Connection Exhaustion)**
If rules trigger HTTP webhooks (external API calls), and those external APIs become slow during the flash sale, our `action-dispatch` workers will spend all their time waiting on network I/O. With `concurrency: 10`, 10 slow requests (e.g., 5-second timeouts) will completely halt the queue processing, causing a massive backlog.

**Bottleneck 2: MongoDB Write Lock / Connection Pool**
While 170 inserts/sec is fine, every processed job updates the `job_history` document to add attempts. If we are processing 170 events/sec * 2 matching rules = 340 updates/sec. Under load, these concurrent document updates can exhaust the MongoDB connection pool and increase latency on the ingestion side (since they share the database).

### Phase 3: How I Would Change It (In Order)

When scaling to this enterprise level, I would implement the following changes in this exact order:

**1. Scale the Action Workers Horizontally (Easiest Win)**
- **What:** Run the `action-dispatch` processors on entirely separate Node.js processes/containers from the ingestion API.
- **Why:** Action dispatching is network-bound. We can scale these out to 50 or 100 concurrent workers without touching the web ingestion tier, ensuring ingestion latency remains < 200ms regardless of how backed up the actions queue gets.

**2. Circuit Breakers for Actions**
- **What:** Implement a circuit breaker (e.g., using `opossum`) in the `ActionFactory`.
- **Why:** If an external API is down, we shouldn't waste 10 seconds timing out 3 times per job, while blocking the queue. The circuit breaker trips and immediately fails the jobs, sending them to the dead letter queue (or marking them `failed` for manual replay later), freeing up worker capacity for healthy endpoints.

**3. Optimize MongoDB Ingestion (Batch Writes)**
- **What:** Instead of inserting `webhook_events` one by one, push them to an in-memory buffer (or Redis list) and flush to MongoDB using `insertMany` every 100ms or 1000 records.
- **Why:** This reduces database IOPS exponentially.

**4. Dedicated Queue Per Tenant (Advanced)**
- **What:** If the enterprise tenant is flooding the system, they will cause "Noisy Neighbor" issues—delaying jobs for smaller tenants. We would use BullMQ's Flow/Group features to create isolated processing queues per tenant or employ fair-share queuing logic.
