---
description: Start local development environment
---

# Start Local Dev Environment

Start both services needed for local EssayBuddy development: FastAPI backend (port 8002) and Next.js frontend (port 3031).

## Instructions

Run these steps in order. Report status after each step. If any step fails, stop and report the error.

### Step 1: Prerequisites Check

Verify required tools are available:
- Run `python3 --version` to verify Python 3.9+ is installed.
- Run `node --version` to verify Node.js 18+ is installed.

If either is missing, tell the user and stop.

### Step 2: Check Dependencies

Check if dependencies are installed:
- If `api/.venv/bin/python3` does not exist, run: `cd /Users/christopherrobinson/Projects/essaybuddy && python3 -m venv api/.venv && cd api && source .venv/bin/activate && pip install -q -r requirements.txt`
- If `web/node_modules` does not exist, run: `cd /Users/christopherrobinson/Projects/essaybuddy/web && npm install --silent`

Ensure data directories exist:
```bash
mkdir -p /Users/christopherrobinson/Projects/essaybuddy/data/{essays,samples/files,profiles,research/papers,research/cache,evidence}
```

### Step 3: Check Port Availability

Check if ports 8002 and 3031 are already in use:
```bash
lsof -i :8002 -t
lsof -i :3031 -t
```

- If both ports have processes, check if they're the dev servers already running. If so, report "EssayBuddy already running — API on :8002, Web on :3031" and stop (success).
- If only one is running, report which one is already up and only start the missing one.
- If stale processes are found, ask the user before killing them.

### Step 4: Start API Server

```bash
cd /Users/christopherrobinson/Projects/essaybuddy/api && source .venv/bin/activate && ESSAYBUDDY_DEV=1 python3 main.py
```

Run this in the background. The `ESSAYBUDDY_DEV=1` env var enables uvicorn's hot reload for development. Wait up to 10 seconds for the server to respond.

Verify with:
```bash
curl -sf http://localhost:8002/health
```

If it doesn't respond after 10 seconds, show any error output and stop.

### Step 5: Start Web Dev Server

```bash
cd /Users/christopherrobinson/Projects/essaybuddy/web && npm run dev
```

Run this in the background. Wait up to 15 seconds for the server to be ready.

Verify with:
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3031
```

### Step 6: Report

If both servers are running, report:

**EssayBuddy is running**
- API: http://localhost:8002
- Web: http://localhost:3031

If either failed, show the error output from that service.
