# Debales AI - Webhook Automation Engine

This project is a backend system that listens for incoming webhook events (like a Shopify order or a payment failure), checks if any automation rules apply, and then runs an action automatically - like sending an email or calling another API.

Everything runs reliably in the background. If something crashes or an external API is down, the system retries automatically and keeps a record of every attempt so you can see exactly what happened.

---

## Getting Started

You only need **Docker Desktop** installed. That's it. No Node.js, no MongoDB, no Redis - Docker handles all of it.

> **Before you begin:** Make sure **Docker Desktop is open and running** on your machine. You should see the Docker whale icon in your system tray (bottom-right of the taskbar). If Docker is not running, the `docker-compose` commands will fail.

### Step 1 - Download the code

Open a terminal and run:

Mac / Linux / Windows (any terminal):
```bash
git clone https://github.com/lalitraj881/Webhook-Engine.git
cd Webhook-Engine
```

### Step 2 - Copy the environment file

This creates a config file the app needs to know things like database addresses and ports.

Mac / Linux (bash):
```bash
cp .env.example .env
cp .env.example backend/.env
```

Windows - Command Prompt (CMD):
```cmd
copy .env.example .env
copy .env.example backend\.env
```

Windows - PowerShell:
```powershell
Copy-Item .env.example .env
Copy-Item .env.example backend\.env
```

### Step 3 - Start everything

This one command downloads, builds, and starts the database, queue, backend API, and dashboard all at once.

> **Make sure Docker Desktop is running before executing this command.**

Works in CMD, PowerShell, and bash — all the same:
```cmd
docker-compose up -d --build
```

Wait about 15 seconds for everything to boot up.

### Step 4 - Open the dashboard

Go to: **http://localhost:5173**

The first time you start the app, it automatically creates two demo companies (tenants) with pre-configured rules - so you can start testing right away.

---

## Running the Test Scenarios

We've included simple scripts you can run from the terminal to simulate incoming webhooks. No Postman or API tools needed.

Open a new terminal window in the project root folder before running these.

---

### Test 1 - Normal webhook (happy path)

This sends a fake Shopify order for $750 to Company A ("Acme Corp"). They have a rule that fires on any order over $500.

Mac / Linux (bash):
```bash
./scripts/send-webhook.sh 6a460515c610ca63064b6027
```

Windows - Command Prompt (CMD):
```cmd
powershell -ExecutionPolicy Bypass -File scripts\send-webhook.ps1 -TenantId 6a460515c610ca63064b6027
```

Windows - PowerShell:
```powershell
.\scripts\send-webhook.ps1 -TenantId 6a460515c610ca63064b6027
```

**What you'll see on the dashboard:**

Make sure "Acme Corp" is selected in the tenant dropdown at the top right.

- **Dashboard tab** - The "Total Jobs" counter goes up, and the "Completed" count increases.
- **Events tab** - A new row appears with source "shopify", event type "order.created", and a green "processed" badge.
- **Jobs tab** - Three separate rows appear (one for each action the rule ran). You'll see:
  - "High-Value Order Alert" with an `email` badge - status: completed
  - "High-Value Order Alert" with a `log` badge - status: completed
  - "Order Slack Notification" with a `webhook` badge - status: completed

Each row shows "1" in the Attempts column, meaning it worked first try. Click "View Details" on any row to see the full execution result including the response from the external API.

---

### Test 2 - Sending the same webhook twice (deduplication)

This sends the exact same webhook two times, one second apart.

Mac / Linux (bash):
```bash
./scripts/send-duplicate.sh 6a460515c610ca63064b6027
```

Windows - Command Prompt (CMD):
```cmd
powershell -ExecutionPolicy Bypass -File scripts\send-duplicate.ps1 -TenantId 6a460515c610ca63064b6027
```

Windows - PowerShell:
```powershell
.\scripts\send-duplicate.ps1 -TenantId 6a460515c610ca63064b6027
```

The system processes the first one normally. When the second arrives, it recognises it's a duplicate and ignores it. You will only ever see one job - never two. This is how we guarantee nothing gets processed twice, even if a platform sends it again.

**What you'll see on the dashboard:**

- **Events tab** - Only ONE new event row appears, even though the script sent the webhook twice. The second one was caught before it even hit the database.
- **Jobs tab** - The job count goes up by exactly 3 (for the 3 actions), not 6. The duplicate was dropped before any jobs were created.

The terminal output from the script will also show you the second request returned `"status": "duplicate"` instead of `"status": "accepted"`.

---

### Test 3 - Failure, retries, and replay (Company B)

This sends a webhook to Company B ("Beta Store"). Their rule is deliberately configured to call a broken API that always returns a 500 error.

> Note: You can also use `send-webhook.ps1` with Beta Store's tenant ID and you'll get the same result - Beta Store's failure rule listens for the same `shopify / order.created` event type.

Mac / Linux (bash):
```bash
./scripts/trigger-failure.sh 6bb71626d721db74175c7138
```

Windows - Command Prompt (CMD):
```cmd
powershell -ExecutionPolicy Bypass -File scripts\trigger-failure.ps1 -TenantId 6bb71626d721db74175c7138
```

Windows - PowerShell:
```powershell
.\scripts\trigger-failure.ps1 -TenantId 6bb71626d721db74175c7138
```

**What you'll see on the dashboard:**

Switch to "Beta Store" in the top-right tenant dropdown first.

- **Jobs tab** - A new row appears for "Intentional Failure Rule (Demo)" with a `webhook` badge. The status column will cycle through:
  1. `pending` (just arrived)
  2. `retrying` (first attempt failed, waiting to try again)
  3. `retrying` (second attempt failed)
  4. `failed` (all 3 attempts exhausted)

- **View Details** - Click "View Details" on the failed job. You'll see a full timeline showing Attempt #1, Attempt #2, and Attempt #3, each with:
  - The exact timestamp it started and finished
  - The error message: `HTTP 500: INTERNAL SERVER ERROR`

- **Replay** - At the bottom of the detail view there is a "Replay This Job" button. Click it. The system creates a brand new job with the same original payload and runs it through the retry cycle again. A new row will appear in the Jobs tab for the replayed attempt.

---


## Troubleshooting & Useful Docker Commands

All `docker-compose` commands work the same in **CMD, PowerShell, and bash**.

> **Docker Desktop must be running** before any of these commands will work.

**See what the app is doing right now:**
```cmd
docker-compose logs -f
```

**See only the backend logs (good for watching jobs run in real-time):**
```cmd
docker-compose logs -f backend
```

**Restart the app cleanly:**
```cmd
docker-compose down
docker-compose up -d --build
```

**Wipe the database and start completely fresh:**

The demo tenants and rules get re-created automatically on the next boot, so your test scripts will still work.
```cmd
docker-compose down -v
docker-compose up -d --build
```

**If you get a "container name already in use" error:**
```cmd
docker rm -f webhook-engine-mongo webhook-engine-redis webhook-engine-backend webhook-engine-frontend
docker-compose up -d
```

---

## How It's Built

### The four database collections

The system uses MongoDB with four collections. Here's why each one exists:

1. **`tenants`** - Stores each company's config, including a secret key used to verify that incoming webhooks are actually from them and not someone faking it.

2. **`webhook_events`** - Every incoming webhook is saved here before any processing starts. This gives us a full audit trail. There's also a unique index that acts as a backup deduplication check, in case Redis restarts and forgets about a recent event.

3. **`automation_rules`** - The rules each company has configured. Each rule says: "when event type X arrives from source Y, and the payload matches condition Z, do action A."

4. **`job_history`** - Records every job execution. Each job stores all its retry attempts as an array inside the same document. This means the dashboard only needs one database query to show the full history of a job - no extra lookups needed. The original event payload is also saved here, so replays always use the exact same data even if the original event has been cleaned up.

---

### The queue design

The system uses two separate queues:

1. **`webhook-processing`** - A fast queue. It receives the raw event, looks up matching rules, and fans out to the next queue.
2. **`action-dispatch`** - A slower queue. This is where the actual work happens - HTTP calls, emails, logs.

They're separate on purpose. If an external API is slow or down, it only affects the dispatch queue. New webhooks keep flowing in and getting evaluated without any backlog.

If a worker process crashes in the middle of a job, BullMQ detects this and automatically re-queues the job once the lock expires. Nothing gets silently lost.

Failed actions are retried three times with increasing delays (5s, then 15s, then 45s) so we don't hammer a struggling external service.

---

## The Scaling Question

The brief asked: what happens when one enterprise tenant sends 500,000 orders per day, each triggering three webhooks - 1.5 million events a day, with 10x spikes during flash sales?

That works out to about 17 events per second normally, and up to 170 per second during a spike.

**Here's how the current design handles that:**

The ingestion endpoint is intentionally lightweight. When a webhook comes in, all it does is verify the HMAC signature, check Redis for duplicates, write one record to MongoDB, and push a job onto the queue. The 200 response goes back immediately. A single Node.js process can easily handle well over 1,000 requests per second doing this kind of work. The 10x spike hits the queue, not the API - so nothing gets dropped.

**Where it breaks first:**

The first bottleneck will be the action dispatch workers. With 10 concurrent workers, if the external APIs start responding slowly (say, 5 seconds each), all 10 workers get tied up waiting and the queue stalls. More events pile up faster than they get processed.

The second bottleneck is MongoDB writes. At 170 events/sec matching 2 rules each, that's 340 document updates per second. Under sustained load, this can exhaust the connection pool and start slowing down ingestion.

**What I'd fix, in order:**

**1. Scale the dispatch workers horizontally**

Run the `action-dispatch` processors in separate containers, completely isolated from the ingestion API. These are network-bound, so spinning up 50 or 100 of them in parallel is straightforward and keeps ingestion latency under 200ms no matter how backed up the actions queue gets.

**2. Add circuit breakers**

If an external API is down, we should stop trying after the first few failures rather than burning through all 3 retry attempts on every job. A circuit breaker (using a library like `opossum`) trips after repeated failures and immediately marks jobs as failed for manual replay - freeing up workers for healthy endpoints.

**3. Batch MongoDB writes**

Instead of writing one webhook event at a time, collect them in a short buffer and flush every 100ms using `insertMany`. This cuts database round-trips dramatically at high volume.

**4. Per-tenant queues (if needed)**

If one enterprise tenant is sending 10x the normal volume during a flash sale, they risk slowing down everyone else's jobs. The fix is isolated queues per tenant, or a fair-share scheduling approach so no single tenant can starve the others.
