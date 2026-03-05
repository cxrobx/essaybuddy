---
name: humanize-text
description: Rewrite text so it sounds natural and human while preserving meaning. Use when users ask to humanize writing, remove AI-sounding patterns, reduce robotic tone, or adapt generated text to a personal voice.
---

# Humanize Text

Rewrite prose so it reads like a real person wrote it, not a model.

## Workflow

1. Parse constraints first.
- Preserve meaning, facts, entities, numbers, and dates.
- Keep the user's intent and point of view unless they ask for a shift.
- If voice is unspecified, default to clear, direct, conversational English.

2. Remove AI artifacts.
- Cut significance inflation and promotional filler.
- Remove rhetorical setup lines and throat-clearing openers.
- Replace vague attributions only when real attribution exists in the source; otherwise cut.
- Collapse mechanical patterns such as `not only X, but also Y`, forced rule-of-three lists, and dramatic one-line fragments.
- Replace inflated verbs (`serves as`, `boasts`, `leverages`) with plain verbs (`is`, `has`, `uses`).

3. Rebuild with natural voice.
- Use contractions unless user asked for formal tone.
- Mix sentence and paragraph length.
- Vary sentence openings; avoid repetitive cadence.
- Keep language specific and concrete.
- Allow occasional fragments for emphasis when they sound natural.

4. Run final QA.
- Remove chatbot residue (for example: `Great question`, `Certainly`, `I hope this helps`).
- Avoid decorative emoji and unnecessary bolding.
- Check for banned phrases and replace them.
- Ensure output is only the rewrite unless the user asked for commentary.

## Banned Phrases and Habits

Avoid these patterns:
- `In today's ...`
- `In the ever-evolving ...`
- `When it comes to ...`
- `At the end of the day ...`
- `Only time will tell`
- `Not only X, but also Y`
- Opening with a summary of what will be said
- Closing with a recap of what was said

Prefer concise replacements:
- `In order to` -> `To`
- `Due to the fact that` -> `Because`
- `At this point in time` -> `Now`
- `Has the ability to` -> `Can`

## Safety and Fidelity

- Never invent sources, quotes, dates, or statistics.
- Keep uncertainty honest and concise.
- In high-stakes contexts, prioritize factual fidelity over stylistic flourish.
- If the source text contains weak claims, do not add fake evidence.

## Output

- Default output: rewritten text only.
- If explicitly requested: append a short `Change notes` section with top edits.

## Headless Script

Use the script for non-interactive/CI runs:

```bash
echo "text to humanize" | python3 skills/humanize-text/scripts/humanize.py --stdin --profile-id <profile_id>
```

Essay mode:

```bash
python3 skills/humanize-text/scripts/humanize.py --essay-id <essay_id>
```
