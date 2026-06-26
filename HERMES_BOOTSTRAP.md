# 🚀 M&E Fresh Eggs — Hermes Agent Bootstrap Instructions

> **Purpose:** This file contains everything needed to replicate this Hermes Agent session on a new host (Hostinger or any other). Follow these steps in order.
>
> **Last updated:** 2026-06-27

---

## 1. Prerequisites

### 1.1 Hermes Agent Installation
```bash
# Install Hermes Agent
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash

# Verify installation
hermes --version

# Run setup wizard (configures model, terminal, gateway)
hermes setup
```

### 1.2 Python Environment
- Python 3.11+ required
- `execute_code` tool requires `pip install` access
- On Hostinger shared hosting, you may need a VPS or dedicated server (shared hosting won't support WebSocket gateway)

### 1.3 Environment Variables (~/.hermes/.env)
```
OPENROUTER_API_KEY=your_key_here
DEEPSEEK_API_KEY=your_key_her
# Add any other provider keys
```

---

## 2. Copy These Files from Source PC

### 2.1 Core Config Files
| File | Purpose | Location on source PC |
|------|---------|----------------------|
| `~/.hermes/config.yaml` | Main config (providers, model, agent, display, etc.) | Transfer as-is |
| `~/.hermes/.env` | API keys | Transfer as-is (protect permissions: `chmod 600`) |
| `~/.hermes/auth.json` | OAuth tokens / credential pools | Transfer as-is |
| `~/.hermes/hermes-agent/plugins/m-e-commands/__init__.py` | M&E slash command plugin (`/sale`, `/delivery`) | Recreate from repo |

### 2.2 Skills (copy entire directory)
```
~/.hermes/skills/supabase/
├── me-sales-input/
│   └── SKILL.md          # Sales input business rules + pitfalls
├── me-delivery-input/
│   └── SKILL.md          # Delivery input business rules + pitfalls
└── ...

~/.hermes/skills/software-development/
├── daily-reporting/
│   └── SKILL.md          # Daily report generation
└── ...

~/.hermes/skills/supabase/
└── supabase-data-lookup/
    └── SKILL.md          # Supabase REST API read patterns
```

### 2.3 M&E Knowledge Base
| File | Purpose |
|------|---------|
| `~/M-EFresheggs/memory.md` | **Source of truth** — full project documentation (schema, API, recent changes, pitfalls) |
| `~/M-EFresheggs/database_schema.sql` | DB schema (for reference) |
| `~/M-EFresheggs/migration_suppliers_deliveries.sql` | Migration (for reference) |
| `~/M-EFresheggs/migration_operational_expenses.sql` | Migration (for reference) |

### 2.4 Cron Jobs
After setting up Hermes, recreate these crons via `hermes cron create` or the `cronjob` tool:

| Job | Schedule | Prompt | Skills |
|-----|----------|--------|--------|
| M&E All Data Sync | `*/5 * * * *` | Run `me_sync_and_verify.py` | none (script-based) |
| M&E Weekly Trend Report | `0 9 * * 1` | Generate weekly trend report | openrouter/owl-alpha model |
| M&E Daily Sales Report | `0 8 * * *` | Daily sales report | daily-reporting skill |
| M&E Health Check | `0 */2 * * *` | Run `me_health_check.py` | none (script-based) |
| **1% Daily Revenue Cut** | `0 21 * * *` | Compute and record 1% of day's sales as operational fund | none |

### 2.5 Scripts (if any on source PC)
Check `~/.hermes/cron/` or `~/AppData/Local/hermes/scripts/` for:
- `me_sync_and_verify.py`
- `me_health_check.py`

Transfer to same location on new host.

---

## 3. Supabase Connection (Read-Only via REST)

The agent uses **anon key** for all operations. No service role key needed.

### 3.1 Quick Verification
After setup, test with:
```bash
curl -s "https://npohyeqnaltpqzmmlmej.supabase.co/rest/v1/sales?select=*&limit=1" \
  -H "apikey: <_REDACTED> \
  -H "Authorization: Bearer sb_publishable_QlM4RGEizMrdybxn75T2gA_CYIx7kGi"
```

Should return 1 row with `id`, `egg_size_id`, `quantity`, etc.

### 3.2 MCP Server (for Write Operations)
The MCP server is already configured for you. Ask your agent to "execute some test SQL" and it will either succeed or explain why it can't. If you don't see MCP available, ensure config.yaml has supabase MCP entries.

---

## 4. Agentic Harness — How This Agent Operates

This agent runs as a **GC (Group Chat) agent** in the "M&E Fresh Eggs" Telegram group. It is also referred to as **GC1** (the first GC agent).

### 4.1 Architecture

```
Group Chat (M&E Fresh Eggs) ← Telegram
        │
        ▼
┌──────────────────────────────┐
│  Harness Controller          │
│  ┌────────────────────────┐  │
│  │ Reliability Wrapper    │  │ ← retry, idempotency, timeout
│  │ ┌──────────────────┐  │  │
│  │ │ QA Verification  │  │  │ ← schema, bounds, auth check
│  │ │ ┌────────────┐  │  │  │
│  │ │ │ Agent Core │  │  │  │ ← full tool access
│  │ │ └────────────┘  │  │  │
│  │ └──────────────────┘  │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Circuit Breaker        │  │ ← fail-open after 3 consecutive failures, 60s cooldown
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ Observability Logger   │  │ ← traces, metrics, alerts
│  └────────────────────────┘  │
└──────────────────────────────┘
        │
        ▼
   Supabase (source of truth)
```

### 4.2 OWL / GC Delegation Pattern

This supervisor uses a **two-tier agent structure**:

| Agent | Role | Model | Description |
|-------|------|-------|-------------|
| **OWL** (main) | Orchestrator/Supervisor | Current model (flash/free) | Receives user messages, delegates to GC agents, reports back |
| **GC1** (this agent) | M&E Fresh Eggs Operator | deepseek-v4-flash (default) | Handles all M&E business ops: sales, deliveries, reports, inventory |

**Delegation flow:**
1. User sends message in group → OWL receives it
2. OWL identifies intent → delegates to GC1 via `delegate_task` or inline execution
3. GC1 executes (stock check → MCP SQL insert → report)
4. Result returns to OWL → OWL responds to user

**When OWL acts directly vs. delegates:**
- **OWL handles directly:** Simple queries, meta-questions, model switches, cron management
- **GC1 handles:** All M&E business operations (sales, deliveries, reports, inventory, expenses)

### 4.3 Failure Behavior (Escalation Ladder)

```
Level 0: Tool call succeeds → return result
Level 1: Tool call fails (transient) → retry with backoff (max 2)
Level 2: Tool call fails (persistent) → circuit breaker opens, skip & continue
Level 3: Agent confused/wrong → self-correct loop (5-step protocol: Analyze → Execute → Fact-Check → Self-Correct → Output)
Level 4: 3 consecutive failures → alert OWL (main agent)
Level 5: Agent crashed/stuck → OWL spawns replacement session
Level 6: All recovery fails → DM user (Flak) as final fallback
```

### 4.4 Two-Tier Supabase Access

| Operation | Auth Method | Examples |
|-----------|-------------|---------|
| **Read/Report** | REST API with anon key | fetchSales, fetchInventory, fetchPriceSettings |
| **Write/Input** | MCP SQL tool (INSERT/UPDATE/DELETE) | recordSale, updateInventory, recordDelivery, recordExpense |

**CRITICAL:** REST API with anon key is READ-ONLY. All writes go through MCP SQL (`mcp_M_E_Fresh_Eggs_execute_sql`).

### 4.5 Idempotency

```
idempotency_key = hash(agent_id + tool_name + normalized_params + session_date)
```

If same key already exists → return cached result, skip execution. Prevents duplicate sales/deliveries.

### 4.6 Scope Lock

**This agent = M&E Fresh Eggs ONLY.**
- No other projects (TrendWire, etc.)
- No cross-GC data access
- All skills serve one business

---

## 5. Critical Rules — Copy These Into Agent Memory

Add these to the agent's persistent memory (via `memory` tool or equivalent):

```
CRITICAL_PROTOCOL: 1️⃣ Analyze 2️⃣ Execute & Test 3️⃣ Fact-Check 4️⃣ Self-Correct 5️⃣ Output. Rules: use live Supabase data, no hallucinations, no extra commentary, only what asked.

sales_input_rule: Only execute sales when message starts with `-sale`. Do NOT process sales from plain messages.

user/profile: M&E PM. Strict scope: M&E Fresh Eggs ONLY. Concise emoji-friendly responses. Self-corrects, no hallucinations.

model/budget: default = openrouter/free or deepseek/deepseek-v4-flash. Complex tasks → deepseek-v4-pro.

MCP SQL timescale: CURRENT_DATE = UTC, wrong for PHT. All writes compute PHT date via `SELECT (CURRENT_DATE + INTERVAL '8 hours')::date::text as pht_today` and pass as explicit string.

M&E Supabase: ref=npohyeqnaltpqzmmlmej. anon REST = read-only. MCP SQL = write. cost_per_egg in deliveries = cost PER TRAY.

Egg size IDs: Peewee=1, Pullet=2, Small=3, Medium=4, Large=5, Extra Large=6, Jumbo=7. TRAY_SIZE=30.

Suppliers: Lilanie Fernandez-Robert (ID=1), renren (ID=2).

Agentic harness: GC1 = M&E Fresh Eggs operator. OWL = supervisor. Escalation: retry → circuit breaker → self-correct → alert OWL → DM user. Two-tier auth: REST anon = read, MCP SQL = write. Idempotency via hash key. Scope lock = M&E ONLY.
```

---

## 5. Dashboard URL
**https://mack0y.github.io/M-EFresheggs/**

After any chat-based sale/delivery, refresh the dashboard to verify data appears correctly.

---

## 6. Troubleshooting Checklist

| Symptom | Fix |
|---------|-----|
| "Unknown command /sale" | Ensure `~/.hermes/hermes-agent/plugins/m-e-commands/__init__.py` exists from repo, restart gateway |
| Sales not showing in UI | Check `sale_date` — was it inserted as UTC instead of PHT? Run: `SELECT id, sale_date, sale_time FROM sales ORDER BY id DESC LIMIT 5` |
| MCP SQL not available | Ensure config.yaml has supabase MCP entries; restart gateway |
| Cron jobs missing | Recreate via `hermes cron create` using Section 2.4 above |
| Wrong model being used | Check `~/.hermes/config.yaml` model section — should be free-tier by default |
| "No sales today" but sales exist | Timezone bug — date is off by 1 day. Fix: `(CURRENT_DATE + INTERVAL '8 hours')::date` |

---

## 7. Contact / Reference
- **memory.md in repo:** Always the source of truth for schema and feature changes
- **Cron jobs:** Recreated via agent prompts if lost
- **Persistence:** All durable state is in cron jobs, skills, and config files. Agent memory is rebuildable from this file.

---

> **After completing these steps, your new host should be functionally identical to the current one. Ask the agent to "list recent sales" and "check cron status" to verify.**
