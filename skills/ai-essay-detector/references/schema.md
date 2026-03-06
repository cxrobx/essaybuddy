# Detector Output Schema

```json
{
  "risk_score": 0,
  "risk_level": "low",
  "verdict": "likely_human",
  "confidence": null,
  "flags": [
    {
      "id": "repetition-pattern-1",
      "label": "Repetitive sentence framing",
      "severity": "medium",
      "reason": "Adjacent sentences reuse identical scaffolding.",
      "start_char": 120,
      "end_char": 228,
      "excerpt": "The text excerpt showing the pattern"
    }
  ],
  "evidence_summary": "Short summary describing the strongest observed signals.",
  "suggestions": [
    "Rewrite repeated sentence starts with varied syntax.",
    "Replace abstract claims with concrete examples and entities."
  ],
  "profile_context_provided": false,
  "degraded": false
}
```

## Constraints

- Output must be valid JSON object only.
- `risk_score` must be an integer in `[0, 100]`.
- `confidence` is `null` in CLI output; computed deterministically by the API.
- `risk_level` must match score thresholds.
- `verdict` must match score thresholds.
- `flags` may be empty.
- For each flag:
  - `start_char >= 0`
  - `end_char >= start_char`
  - `severity` in `low|medium|high`
- `profile_context_provided` must be a boolean. `true` when author profile metrics were provided for analysis.
- `degraded` must be a boolean. `true` when fallback values were used due to missing or unparseable fields.
