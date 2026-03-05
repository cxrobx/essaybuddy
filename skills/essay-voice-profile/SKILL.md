---
name: essay-voice-profile
description: Create structured voice profiles from essay samples for EssayBuddy. Use when users provide essays and ask Codex to build, revise, validate, or format `voice_model` JSON (including upload payloads for `/profiles/{profile_id}/voice-model`).
---

# Essay Voice Profile

Create a qualitative voice model from one or more essays and return JSON that can be stored in EssayBuddy profiles.

## Inputs

Accept essay samples as plain text, markdown, or DOCX.

If essays are DOCX, extract text first:

```bash
python scripts/extract_docx_text.py path/to/essay1.docx path/to/essay2.docx --output-dir /tmp/essays
```

## Output Modes

Choose based on the user's request:
1. `voice_model` object only (default)
2. API request body wrapper:
```json
{"voice_model": {...}}
```
3. Profile patch fragment:
```json
{"id": "...", "voice_model": {...}}
```

## Required Schema

Use this structure:

```json
{
  "voice_profile": {
    "summary": "...",
    "tone": "...",
    "sentence_patterns": "...",
    "argument_style": "...",
    "vocabulary_level": "...",
    "rhetorical_devices": ["..."],
    "transition_patterns": "...",
    "paragraph_structure": "...",
    "distinctive_phrases": ["..."],
    "what_to_avoid": "..."
  },
  "voice_examples": [
    {
      "excerpt": "...",
      "demonstrates": "..."
    }
  ],
  "generated_at": "ISO-8601 timestamp",
  "model_used": "codex-gpt-5"
}
```

`voice_examples` rules:
- Include 5-8 excerpts unless the user asks for a different count.
- Keep excerpts representative and non-overlapping.
- Prefer 150-300 words per excerpt.
- Cover different sections where possible: opening, argument body, transitions, synthesis, conclusion.

## Workflow

1. Read all essays end-to-end before writing the profile.
2. Identify recurring voice traits that appear across multiple essays.
3. Extract representative passages verbatim from the provided essays.
4. Draft `voice_profile` using concrete, evidence-backed language.
5. Draft 5-8 `voice_examples` with short `demonstrates` notes.
6. Add `generated_at` and `model_used`.
7. Validate output:
```bash
python scripts/validate_voice_model.py path/to/voice_model.json
```
8. If validation fails, fix JSON and re-run validation.

## Quality Bar

- Do not invent quotes, dates, facts, or citations.
- Prefer specific claims tied to excerpts over generic style labels.
- Capture both positive habits and concrete `what_to_avoid`.
- Keep `distinctive_phrases` literal when possible.
- If style varies across essays, explain the blend explicitly in `summary`.

## API Compatibility

For EssayBuddy integration:
- `POST /profiles/{profile_id}/voice-model`: send `{"voice_model": <object>}`
- `DELETE /profiles/{profile_id}/voice-model`: clear stored model
- Profiles without `voice_model` remain valid and use legacy metrics-only behavior

## Resources (optional)

Load these only as needed.

### scripts/
- `extract_docx_text.py`: extract readable `.txt` files from DOCX essays
- `validate_voice_model.py`: validate schema and content requirements

### references/
- `voice_model_template.json`: canonical output skeleton
- `extraction_rubric.md`: checklist for selecting excerpts and writing profile fields
