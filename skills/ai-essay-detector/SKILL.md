---
name: ai-essay-detector
description: Detect AI-like writing patterns in essay text using Codex CLI in headless mode and return strict JSON risk reports. Use when users ask to assess whether text may trigger AI detectors, run non-interactive checks from scripts/CI, score whole essays or selected sections, or generate evidence-backed suggestions to reduce AI-like patterns.
---

# AI Essay Detector

Run Codex headless to score AI-likeness risk in essay text and return deterministic JSON.

## Workflow

1. Choose input scope.
- Use whole-essay mode for complete draft checks.
- Use selection mode for targeted paragraph checks.

2. Run the detector script.
- Preferred commands:
  - `python skills/ai-essay-detector/scripts/detect.py --stdin --scope selection`
  - `python skills/ai-essay-detector/scripts/detect.py --file /abs/path/essay.md --scope essay`
  - `python skills/ai-essay-detector/scripts/detect.py --text "..." --scope essay`

3. Require strict JSON output.
- The detector must emit JSON only.
- If Codex returns fenced markdown or prose, normalize and validate before returning.

4. Interpret risk.
- `risk_score` 0-29 => `low`
- `risk_score` 30-59 => `medium`
- `risk_score` 60-100 => `high`
- `verdict` thresholds:
  - 0-29 => `likely_human`
  - 30-59 => `mixed`
  - 60-100 => `likely_ai`

5. Apply mitigations.
- Use `flags` and `suggestions` to target edits in high-risk spans.
- Re-run detection after edits to confirm risk decreases.

## Output Contract

Always return this shape:
- `risk_score` (0-100 integer)
- `risk_level` (`low|medium|high`)
- `verdict` (`likely_human|mixed|likely_ai`)
- `confidence` (null in CLI output; computed by the API based on text length, flag coverage, and profile context)
- `flags[]` with spans and reasons
- `evidence_summary` (short paragraph)
- `suggestions[]` (actionable rewrite guidance)
- `profile_context_provided` (boolean, whether author profile was provided for analysis)
- `degraded` (boolean, whether fallback values were used due to parse issues)

Read detailed rubric and schema before modifying behavior:
- [Rubric](references/rubric.md)
- [Schema](references/schema.md)
