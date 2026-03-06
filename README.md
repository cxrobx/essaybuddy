# Zora (EssayBuddy)

Local essay development platform that analyzes your writing samples to match your authentic voice. Upload past work, build a style profile, and write new essays with AI assistance that sounds like *you*.

Built with Next.js 15 + FastAPI, macOS dark theme.

## Prerequisites

- macOS 12+
- Python 3.9+
- Node.js 18+
- [Codex CLI](https://github.com/openai/codex) (for AI skills — outline, expand, rephrase, humanize, score)
- Xcode Command Line Tools (`xcode-select --install`) — needed to build the `.app`

## Quick Start

```bash
git clone https://github.com/cxrobx/essaybuddy.git && cd essaybuddy
bash setup.sh
open launcher/dist/EssayBuddy.app
```

`setup.sh` handles everything: checks prerequisites, installs Python/Node dependencies, copies starter sample data, builds the macOS app, and clears Gatekeeper.

After launch, the app starts the API and web servers automatically, then opens the editor.

## Manual Start (without the app)

```bash
# Terminal 1 — API
cd api && source .venv/bin/activate && python3 main.py

# Terminal 2 — Frontend
cd web && npm run dev
```

- API: http://localhost:8002
- Web: http://localhost:3031

## Codex CLI Skills

From the project root, run `codex` and use natural language to invoke these skills:

| Skill | What it does |
|-------|-------------|
| `essay-outline` | Generate a structured outline from essay topic/thesis |
| `essay-expand` | Expand outline sections into full paragraphs |
| `essay-rephrase` | Rephrase text to match your writing style profile |
| `humanize-text` | Rewrite text to sound natural, removing AI patterns |
| `essay-score` | Score text against your style profile (0-100) |
| `ai-essay-detector` | Detect AI-like writing patterns in your essay |
| `essay-voice-profile` | Build a voice profile from your writing samples |

Example:
```bash
codex
> "Generate an outline for essay f6dfd316"
> "Score my essay against its profile"
> "Humanize the introduction of essay f6dfd316"
```

## Configuration

`setup.sh` creates a `.env` file automatically. Key variables:

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATA_ROOT` | `./data` | Where essays, samples, and profiles are stored |
| `API_PORT` | `8002` | FastAPI server port |
| `WEB_PORT` | `3031` | Next.js dev server port |
| `AI_PROVIDER` | `codex` | AI CLI provider (`codex` or `gemini`) |

## Starter Data

Setup copies example data into `data/` so you can explore immediately:

- A sample essay with full content
- A pre-built style profile
- Two writing samples

Your own data will never be overwritten — starter data is only copied if `data/essays/` is empty.

## Troubleshooting

**Ports in use:**
```bash
lsof -ti:8002 | xargs kill -9    # Kill stale API
lsof -ti:3031 | xargs kill -9    # Kill stale web
```

**Gatekeeper blocks the app:**
```bash
xattr -dr com.apple.quarantine launcher/dist/EssayBuddy.app
```

**Xcode CLI tools missing** (can't build `.app`):
```bash
xcode-select --install
bash setup.sh   # Re-run after install
```

You can still run manually via terminal without the app — see [Manual Start](#manual-start-without-the-app).

## Technical Docs

See [AGENTS.md](AGENTS.md) for full architecture, API endpoints, data formats, and AI agent instructions.
