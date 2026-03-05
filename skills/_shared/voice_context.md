# Voice Context Construction

Use this reference to build style context for all voice-matched generation tasks.

## Inputs

- Profile JSON: `data/profiles/{profile_id}.json`
- Optional samples: `data/samples/*.json`

## Build Order

1. Build `<voice-profile>` block from `voice_model.voice_profile` when available.
2. Build `<voice-examples>` block from `voice_model.voice_examples` when available.
3. Build `<style-metrics>` block from `metrics` as quantitative fallback/supplement.
4. Append directive text for voice imitation and citation style if present.

## Voice Profile Fields

Read these fields when present:

- `summary`
- `tone`
- `sentence_patterns`
- `argument_style`
- `vocabulary_level`
- `transition_patterns`
- `paragraph_structure`
- `what_to_avoid`
- `rhetorical_devices[]`
- `distinctive_phrases[]`

## Voice Directive

When `voice_model` exists:

`Write in the exact voice and style shown in the Voice Profile and Writing Examples above. Mimic the vocabulary, sentence structure, transition patterns, and argument style from the examples. Do NOT sound like AI — sound like the human author of those examples.`

Fallback without `voice_model`:

`Match the writing style described above.`

## Citation Directive

Only add citation instruction for supported styles:

- `apa7`
- `mla9`
- `chicago-notes`
- `chicago-author`
- `ieee`
- `harvard`

Directive format:

`Citation Style: Use <label> format for all citations, references, and evidence. Format in-text citations, footnotes, and reference entries according to <label> conventions.`
