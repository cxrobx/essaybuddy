---
name: essay-rephrase
description: Rephrase text to match an EssayBuddy profile's writing voice while preserving meaning. Use when users ask to rewrite selected text in their own style, or need a headless CLI/CI rephrase operation with profile-aware humanization.
---

# Essay Rephrase

Rewrite text in the author voice from a profile.

## Workflow

1. Load input text.
- Accept `--stdin` or `--text`.

2. Load profile.
- Require `--profile-id`.

3. Rephrase, then humanize.
- First pass: style-matching rephrase prompt.
- Second pass: apply universal and profile-specific humanize constraints.

4. Run headless script.
```bash
echo "original paragraph" | python3 skills/essay-rephrase/scripts/rephrase.py --stdin --profile-id <profile_id>
```

## Output Contract

Return plain text only.

## Notes

- Preserve meaning and factual content.
- Use exit code `2` for invalid input.
- Use exit code `4` for runtime/model failures.

## Resources

- Script: `scripts/rephrase.py`
- Shared context helpers: `../_shared/scripts/essay_context.py`
- Shared humanize rules: `../_shared/humanize_rules.md`
