---
name: essay-expand
description: Expand an EssayBuddy outline section into full paragraphs using the essay context, profile voice model, and optional evidence items. Use when users ask to draft a specific section from an outline title/index or need headless section expansion in CLI/CI.
---

# Essay Expand

Expand one outline section into 2-3 paragraphs that match the profile voice.

## Workflow

1. Resolve target section.
- Read `data/essays/{essay_id}.outline.json`.
- Match `--section` by title or numeric index.

2. Load context.
- Essay markdown and frontmatter.
- Profile voice model.
- Optional evidence payload via `--evidence-json`.
- Sample excerpts from writing samples.

3. Generate section draft, then humanize pass.
- First pass: section expansion prompt.
- Second pass: humanization prompt with profile-specific constraints.

4. Run headless script.
```bash
python3 skills/essay-expand/scripts/expand_section.py --essay-id <essay_id> --section "Introduction"
```

## Output Contract

Return plain text only (no JSON, no markdown fencing, no metadata).

## Notes

- Use exit code `2` for invalid input.
- Use exit code `4` for runtime/model failures.
- Do not write essay files directly in this flow.

## Resources

- Script: `scripts/expand_section.py`
- Shared context helpers: `../_shared/scripts/essay_context.py`
- Shared humanize rules: `../_shared/humanize_rules.md`
