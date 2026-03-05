# Data Loading Rules

Use these paths for CLI skill workflows.

## Canonical Paths

- Essays: `data/essays/{essay_id}.md`
- Outline sidecar: `data/essays/{essay_id}.outline.json`
- AI check history: `data/essays/{essay_id}.ai-checks.json`
- Profiles: `data/profiles/{profile_id}.json`
- Samples: `data/samples/{sample_id}.json`
- Sample files: `data/samples/files/*`
- Research papers: `data/research/papers/{paper_id}.json`

## Essay Markdown Format

Essays are markdown with YAML frontmatter and body text.

Frontmatter keys commonly used by AI workflows:

- `title`
- `topic`
- `thesis`
- `profile_id`
- `citation_style`
- `target_word_count`
- `instructions`
- `created_at`
- `updated_at`

## Fallback Rules

1. For `--essay-id` flows, prefer essay frontmatter values unless CLI overrides are provided.
2. For profile selection, use CLI `--profile-id` override first, then essay `profile_id`.
3. For sample context, include available sample excerpts and continue if none exist.
4. If `voice_model` is missing, fall back to metrics-only style context.

## Write Safety

1. Default behavior: print results to stdout.
2. Perform file writes only when explicit write flags are passed.
3. Use atomic writes (`*.tmp` + `os.replace`) for JSON/markdown outputs.
