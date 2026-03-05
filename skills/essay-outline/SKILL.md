---
name: essay-outline
description: Generate structured EssayBuddy outline sections from essay metadata and a style profile. Use when users ask to create, regenerate, or refine an outline for an essay ID, or need a headless CLI/CI outline generation workflow that writes `data/essays/{id}.outline.json`.
---

# Essay Outline

Generate a JSON outline aligned to the author's profile voice and essay brief.

## Workflow

1. Resolve inputs.
- Prefer `--essay-id` mode.
- Use manual mode only when `--topic` and `--profile-id` are provided.

2. Load data from `data/`.
- Essay frontmatter: topic, thesis, profile_id, citation_style, target_word_count, instructions.
- Profile JSON: voice model + metrics.
- Sample excerpts: `data/samples/*.json`.

3. Build prompt layers in this order.
- Style context
- Sample excerpts
- Essay briefing
- Voice + citation directives
- Task instructions

4. Run headless script.
```bash
python3 skills/essay-outline/scripts/generate_outline.py --essay-id <essay_id>
```

5. Write sidecar only when requested.
```bash
python3 skills/essay-outline/scripts/generate_outline.py --essay-id <essay_id> --write-outline
```

## Output Contract

Return only a JSON array of sections. Each section must include:
- `id`
- `title`
- `notes`
- `evidence`

## Notes

- Use exit code `2` for invalid input.
- Use exit code `4` for runtime/model failures.
- Keep default behavior stdout-only; avoid writes unless `--write-outline` is provided.

## Resources

- Script: `scripts/generate_outline.py`
- Shared context helpers: `../_shared/scripts/essay_context.py`
- Shared execution helpers: `../_shared/scripts/codex_exec.py`
- Shared docs: `../_shared/voice_context.md`, `../_shared/data_loading.md`
