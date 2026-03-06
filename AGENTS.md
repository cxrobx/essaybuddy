# EssayBuddy

Local essay development platform that analyzes writing samples to match your authentic voice. Built with Next.js 15 + FastAPI, macOS dark theme.

## Quick Setup

```bash
# One-command bootstrap (checks prerequisites, installs everything)
bash setup.sh
```

Or manually:
```bash
# Backend
cd api && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python3 main.py

# Frontend
cd web && npm install && npm run dev
```

**Requirements:** Python 3.9+, Node.js 18+

- API: http://localhost:8002
- Web: http://localhost:3031

## Architecture

```
essaybuddy/
├── AGENTS.md              # This file (CLAUDE.md, GEMINI.md are symlinks)
├── setup.sh               # One-command bootstrap script
├── compose.yaml           # Docker (web only, API runs on host)
├── api/                   # FastAPI backend (Python 3.9+)
│   ├── main.py            # App entry, CORS, NLTK bootstrap
│   ├── requirements.txt   # Python dependencies
│   ├── routers/
│   │   ├── essays.py      # Essay CRUD (markdown + frontmatter)
│   │   ├── samples.py     # Writing sample upload/management
│   │   ├── profiles.py    # Style profile analysis + voice models
│   │   ├── ai.py          # AI generation (outline, expand, rephrase, humanize, score)
│   │   ├── ai_detection.py # AI pattern detection endpoints + history
│   │   └── research.py    # Research paper search, save, cite endpoints
│   └── services/
│       ├── sandbox.py     # Path sandboxing + atomic writes
│       ├── style_analyzer.py  # NLP style metrics (nltk + textstat)
│       ├── file_parser.py     # Parse uploaded files (docx, pdf, txt)
│       ├── ai_provider.py     # AI provider abstraction
│       ├── codex_provider.py  # Codex CLI wrapper
│       ├── gemini_provider.py # Gemini CLI wrapper
│       ├── ai_pattern_detector.py # Skill subprocess bridge for AI checks
│       ├── research_client.py    # Async HTTP client (S2 primary, OpenAlex fallback, Unpaywall, CrossRef)
│       └── citation_formatter.py # Deterministic citation formatting (6 styles)
├── web/                   # Next.js 15 frontend
│   ├── app/
│   │   ├── layout.tsx     # Root layout
│   │   ├── page.tsx       # Home page
│   │   ├── editor/        # Editor page
│   │   └── research/      # Standalone research page
│   ├── components/
│   │   ├── Editor/
│   │   │   ├── index.tsx          # Editor shell (state, auto-save, layout)
│   │   │   ├── RichTextEditor.tsx # TipTap with tiptap-markdown extension
│   │   │   ├── Toolbar.tsx        # Formatting toolbar
│   │   │   ├── OutlinePanel.tsx   # Essay outline sidebar
│   │   │   ├── AIPanel.tsx        # AI assistant panel
│   │   │   ├── ResearchPanel.tsx  # Research sidebar (search + saved papers)
│   │   │   └── StyleScore.tsx     # Style match scoring
│   │   ├── Research/
│   │   │   ├── SearchBar.tsx      # Search input with debounce + filters
│   │   │   ├── PaperCard.tsx      # Paper display card (compact/full)
│   │   │   ├── PaperList.tsx      # Scrollable paper list with pagination
│   │   │   ├── CitationPopover.tsx # Citation style selector + copy/insert
│   │   │   └── SavedPapersView.tsx # Saved papers with filter tabs
│   │   ├── Samples/
│   │   │   ├── UploadModal.tsx    # Sample file upload
│   │   │   └── SampleList.tsx     # Sample management + profile creation
│   │   └── ui/
│   │       ├── Modal.tsx          # Reusable modal component
│   │       └── StatusBadge.tsx    # Save status indicator
│   └── lib/
│       ├── api.ts         # API client functions
│       ├── types.ts       # TypeScript type definitions
│       └── useAutoSave.ts # 700ms debounced auto-save hook
├── data/                  # File-based storage (git-ignored)
│   ├── essays/            # Markdown files with YAML frontmatter
│   ├── samples/           # Writing samples (JSON metadata + files/)
│   ├── profiles/          # Style profiles (JSON)
│   └── research/
│       └── papers/        # Saved research papers (JSON per paper)
├── skills/                # Codex CLI skills
│   ├── _shared/           # Shared prompt docs + script helpers
│   │   ├── voice_context.md
│   │   ├── data_loading.md
│   │   ├── humanize_rules.md
│   │   └── scripts/
│   │       ├── essay_context.py
│   │       ├── codex_exec.py
│   │       └── io_utils.py
│   ├── ai-essay-detector/ # Detect AI-like writing patterns
│   ├── essay-voice-profile/ # Build voice profiles from samples
│   ├── humanize-text/     # Humanize text (interactive + headless script)
│   ├── essay-outline/     # Generate structured outlines
│   ├── essay-expand/      # Expand sections into paragraphs
│   ├── essay-rephrase/    # Rephrase text in author voice
│   └── essay-score/       # Score style match (0-100)
└── launcher/              # macOS native app wrapper
    ├── EssayBuddy.swift   # Swift app (WKWebView, server lifecycle, auto-install)
    ├── build.sh           # Compile universal binary + create DMG
    └── Info.plist         # Bundle config (com.cx.essaybuddy)
```

## Essay Storage Format

Essays are stored as **plain markdown files** at `data/essays/{id}.md` with YAML frontmatter:

```markdown
---
title: "My Essay Title"
topic: "Climate Change"
thesis: "Climate change requires immediate action"
profile_id: "prof_abc123"
created_at: "2026-03-04T21:13:00Z"
updated_at: "2026-03-04T21:20:15Z"
---

# Introduction

Essay content here in plain markdown...
```

Outlines are stored as sidecar files: `data/essays/{id}.outline.json`

**This means you can read and edit essay files directly.** The web UI will pick up external changes on reload.

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness check |
| GET/POST | `/essays` | List / Create essay |
| GET/PUT/DELETE | `/essays/{id}` | Read / Update / Delete |
| GET | `/samples` | List samples |
| GET | `/samples/{id}` | Get sample with text |
| POST | `/samples/upload` | Upload sample (multipart) |
| DELETE | `/samples/{id}` | Delete sample |
| POST | `/profiles/analyze` | Build style profile from samples |
| GET | `/profiles` | List profiles |
| GET | `/profiles/{id}` | Get profile with metrics |
| POST | `/profiles/{id}/voice-model` | Generate AI voice model for profile |
| DELETE | `/profiles/{id}/voice-model` | Remove voice model from profile |
| POST | `/ai/generate-outline` | Generate essay outline |
| POST | `/ai/expand-section` | Expand section to paragraphs |
| POST | `/ai/rephrase` | Rephrase text in user's style |
| POST | `/ai/humanize` | Rewrite text to sound more natural |
| POST | `/ai/detect-patterns` | Detect AI-like writing patterns (Codex headless) |
| GET | `/ai/detect-patterns/history/{essay_id}` | Get saved detection checks for essay |
| POST | `/ai/style-score` | Score text against profile |
| GET/PUT | `/ai/provider` | Get/switch AI provider |
| GET | `/research/search?q=&year_min=&year_max=&limit=&offset=&fields_of_study=` | Search papers via OpenAlex |
| GET | `/research/paper/{paper_id}` | Paper details + Unpaywall PDF link |
| POST | `/research/save` | Save paper to local library |
| GET | `/research/saved?essay_id=` | List saved papers (optional essay filter) |
| DELETE | `/research/saved/{paper_id}` | Remove saved paper |
| PUT | `/research/saved/{paper_id}/link` | Link/unlink paper to an essay |
| GET | `/research/cite/{paper_id}?style=apa7` | Get formatted citation |
| POST | `/research/cite/batch` | Batch citation formatting |

## Key Patterns

- **Markdown storage**: Essays are `.md` files with YAML frontmatter, parsed via `python-frontmatter`
- **Outline sidecar**: Structured outline data in `{id}.outline.json`, separate from clean markdown
- **Atomic writes**: All file saves use write-to-temp + `os.replace()` to prevent corruption
- **Auto-save**: 700ms debounced save with sequential execution (no overlapping writes)
- **Path sandboxing**: All file operations go through `services/sandbox.py` — no path escapes `DATA_ROOT`
- **AI providers**: CLI subprocess wrappers (Codex/Gemini) with sandboxed execution
- **AI detector skill**: Project-local skill at `skills/ai-essay-detector` powers pattern checks
- **Voice models**: AI-generated voice profiles from writing samples, used for style-matched generation
- **Research pipeline**: Semantic Scholar (primary, has native TLDRs) → OpenAlex (fallback, AI-generated TLDRs) → Unpaywall (free PDFs by DOI) → CrossRef (citation metadata)
- **Citation formatting**: Deterministic formatter supporting APA7, MLA9, Chicago Notes/Author-Date, IEEE, Harvard
- **Research storage**: Saved papers at `data/research/papers/{paper_id}.json`, linkable to essays
- **TipTap editor**: ProseMirror-based with `tiptap-markdown` extension, loaded with `dynamic()` (SSR disabled)
- **macOS launcher**: Swift app auto-installs deps (venv, npm), kills stale ports, resolves repo path dynamically

## CLI Workflow (Codex)

All major essay operations can run directly from Codex CLI against local `data/` files.

### Quick Reference

| Operation | Interactive (ask Codex) | Headless (script) |
|-----------|--------------------------|-------------------|
| List essays | "Show me my essays" | `ls data/essays/*.md` |
| Generate outline | "Generate an outline for essay {id}" | `python3 skills/essay-outline/scripts/generate_outline.py --essay-id {id}` |
| Generate + save outline | "Generate and save an outline for essay {id}" | `python3 skills/essay-outline/scripts/generate_outline.py --essay-id {id} --write-outline` |
| Expand section | "Expand section 0 for essay {id}" | `python3 skills/essay-expand/scripts/expand_section.py --essay-id {id} --section 0` |
| Rephrase text | "Rephrase this paragraph to match profile {id}" | `echo "text" \| python3 skills/essay-rephrase/scripts/rephrase.py --stdin --profile-id {id}` |
| Humanize text | "Humanize this paragraph in my voice" | `echo "text" \| python3 skills/humanize-text/scripts/humanize.py --stdin --profile-id {id}` |
| Humanize essay | "Humanize essay {id}" | `python3 skills/humanize-text/scripts/humanize.py --essay-id {id}` |
| Style score | "Score essay {id} against its profile" | `python3 skills/essay-score/scripts/score.py --essay-id {id}` |
| AI detection | "Check essay {id} for AI patterns" | `python3 skills/ai-essay-detector/scripts/detect.py --file data/essays/{id}.md --scope essay` |
| Build voice profile | "Build a voice profile from my samples" | (use `essay-voice-profile` skill interactively) |

### Data Access

Essays, profiles, samples, and outlines are plain files in `data/`:

- **Essays**: `data/essays/{id}.md` (YAML frontmatter + markdown body)
- **Outlines**: `data/essays/{id}.outline.json` (sections with `id`, `title`, `notes`, `evidence`)
- **Profiles**: `data/profiles/{id}.json` (`metrics` and optional `voice_model`)
- **Samples**: `data/samples/{id}.json` (`filename`, `text`, metadata)
- **AI Checks**: `data/essays/{id}.ai-checks.json` (detection history)
- **Research**: `data/research/papers/{id}.json` (saved paper metadata)

### Prompt Layering

Generation scripts follow the same prompt structure used by `api/routers/ai.py`:

1. Style context (`voice_model` + metrics fallback)
2. Sample excerpts from `data/samples/*.json`
3. Essay briefing (`topic`, `thesis`, `target_word_count`, `instructions`)
4. Voice/citation directives
5. Task-specific instructions

### Environment for CLI Scripts

- Default `DATA_ROOT` is `./data` (or set via env/`--data-root`)
- Requires Codex authentication (`OPENAI_API_KEY` and/or `CODEX_TOKEN`)

## Environment Variables

| Var | Default | Purpose |
|-----|---------|---------|
| `DATA_ROOT` | `./data` | Storage directory |
| `API_PORT` | `8002` | API server port |
| `WEB_PORT` | `3031` | Frontend dev port |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8002` | API URL for frontend |
| `AI_PROVIDER` | `codex` | AI CLI provider (codex/gemini) |
| `SEMANTIC_SCHOLAR_API_KEY` | *(none)* | Optional S2 API key for higher rate limits |
| `OPENALEX_API_KEY` | *(none)* | Optional OpenAlex API key for premium access |
| `OPENALEX_EMAIL` | `essaybuddy@localhost` | Email for OpenAlex fallback polite pool |
| `UNPAYWALL_EMAIL` | `essaybuddy@localhost` | Email for Unpaywall API identification |

## Troubleshooting

If servers won't start, check for stale processes on the ports:
```bash
lsof -ti:8002 | xargs kill -9    # Kill stale API
lsof -ti:3031 | xargs kill -9    # Kill stale web
```

If the macOS app is blocked by Gatekeeper:
```bash
xattr -dr com.apple.quarantine launcher/dist/EssayBuddy.app
```

For any setup issues, run `bash setup.sh` — it validates all prerequisites and installs dependencies automatically.
