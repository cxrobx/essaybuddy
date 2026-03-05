---
name: essay-score
description: Score style match between input text and an EssayBuddy profile voice/metrics. Use when users ask how closely writing matches a profile, or need a headless CLI/CI JSON scoring pass for essay drafts or selections.
---

# Essay Score

Score style alignment against a profile.

## Workflow

1. Resolve input text.
- Accept `--stdin`, `--text`, or `--essay-id`.

2. Resolve profile.
- Use `--profile-id` override when provided.
- In essay mode, fall back to essay frontmatter `profile_id`.

3. Run scoring prompt.
- Include style context and strict score contract.

4. Run headless script.
```bash
python3 skills/essay-score/scripts/score.py --essay-id <essay_id>
```

## Output Contract

Return JSON object:
- `score` (integer 0-100)
- `feedback` (short explanation)

## Notes

- Use exit code `2` for invalid input.
- Use exit code `4` for runtime/model failures.
- Fail fast if model output is not parseable JSON with required keys.

## Resources

- Script: `scripts/score.py`
- Shared context helpers: `../_shared/scripts/essay_context.py`
