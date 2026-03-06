# AI Pattern Detection Rubric

## Calibration Philosophy

The default assumption is **human-written**. Most student essays score 5-25. A score above 40 requires dense, co-occurring signals across 3+ categories. A single strong signal is never sufficient to push a score past 30.

Key principles:

- **Presume human**: Students write imperfectly. Imperfection is a feature, not a bug. Awkward phrasing, inconsistent style, and structural quirks are signs of authenticity.
- **Require convergence**: AI-generated text is detectable because multiple patterns co-occur at high density. Isolated signals are noise.
- **Respect the profile**: When a style profile is provided and the text's patterns match `profile_metrics`, those patterns represent the author's authentic voice. Do NOT flag them.
- **Weight density over presence**: A transition word appearing once per paragraph is normal. Three in consecutive sentences is a signal. Count frequency relative to text length.

---

## Signal Categories

Each category has a maximum contribution of **10-15 points** to the total `risk_score`. No single category can dominate the overall score.

### 1. Repetition and Syntactic Uniformity (max 15 pts)

Repeated sentence templates, low variation in openings, and uniform cadence across paragraphs.

**WHAT TO FLAG:**
- 4+ consecutive sentences following the same syntactic template (e.g., Subject-Verb-Object with identical clause structure)
- 3+ paragraphs that open with the same grammatical pattern (e.g., all start with a gerund phrase or a prepositional phrase)
- Density threshold: >60% of sentences in a passage share the same structure

**WHAT NOT TO FLAG:**
- Deliberate anaphora or rhetorical repetition (e.g., "We shall fight..." pattern)
- Normal topic sentences that happen to share structure across 2-3 paragraphs
- Lists or enumerations where parallel structure is expected
- Repetition that matches the author's `profile_metrics` sentence patterns

### 2. Hedging and Generic Generalization (max 10 pts)

Abstract statements with weak specifics, overuse of broad qualifiers without evidence.

**WHAT TO FLAG:**
- 3+ hedging phrases per paragraph ("it is important to note," "one might argue," "it could be said")
- Claims that lack any concrete evidence, named entity, date, or specific reference
- Density threshold: >40% of sentences in a paragraph contain hedge phrases

**WHAT NOT TO FLAG:**
- Academic caution appropriate to the discipline (e.g., scientific hedging like "results suggest")
- 1-2 hedge phrases per paragraph, which is normal academic writing
- Introductory or concluding paragraphs that are naturally more general
- Hedging patterns that appear in the author's writing samples

### 3. Over-Structured Transition Cadence (max 10 pts)

Mechanical transition chains (`however`, `moreover`, `therefore`, `furthermore`, `additionally`, `consequently`) at unnatural density.

**WHAT TO FLAG:**
- 3+ formal transition words in consecutive sentences
- Transition words appearing in >50% of sentences within a paragraph
- Predictable transition sequences (e.g., "First... Second... Third... Finally..." across every section)
- Density threshold: >1 formal transition per 2 sentences sustained over 5+ sentences

**WHAT NOT TO FLAG:**
- One transition word per paragraph opening, which is standard essay structure
- Transitions used in genuinely complex arguments where logical connectives are needed
- Informal transitions ("but," "so," "and," "also") which are natural in student writing
- Transition density that matches the author's profile

### 4. Low-Variance Sentence Rhythm (max 15 pts)

Similar sentence lengths across long spans and flat punctuation patterns.

**WHAT TO FLAG:**
- Standard deviation of sentence length <3 words across 10+ consecutive sentences
- No sentence shorter than 8 words or longer than 25 words in a passage of 10+ sentences
- Absence of fragments, questions, or exclamations across 500+ words
- Density threshold: coefficient of variation in sentence length <0.15 over a full paragraph

**WHAT NOT TO FLAG:**
- Passages where the author's profile shows naturally low sentence-length variance
- Short spans (fewer than 8 sentences) where low variance can occur by chance
- Technical or formulaic sections (methods descriptions, procedural writing) where uniform rhythm is expected
- Intentionally measured, formal prose style confirmed by writing samples

### 5. Generic Abstraction vs Concrete Detail (max 15 pts)

Claims without grounded examples, entities, timelines, or lived experience.

**WHAT TO FLAG:**
- 3+ consecutive paragraphs with zero named entities, specific dates, places, or concrete examples
- Entire sections that could apply to any topic without modification (interchangeable generalities)
- Density threshold: <1 concrete detail per 100 words sustained over 200+ words

**WHAT NOT TO FLAG:**
- Theoretical or philosophical essays where abstraction is genre-appropriate
- Introduction and conclusion sections, which are naturally more abstract
- Passages that reference specific concepts, theories, or frameworks even without named entities
- The author's natural level of abstraction as reflected in their writing samples

### 6. Meta-AI Phrasing Indicators (max 10 pts)

Known AI-model boilerplate, formulaic phrases, and telltale constructions.

**WHAT TO FLAG:**
- Direct AI self-references: "As an AI," "I don't have personal experience," "as a language model"
- High-frequency AI boilerplate: "In today's world," "It is worth noting that," "In conclusion, it is clear that," "This is a complex issue with many facets"
- Unnaturally balanced "on one hand / on the other hand" constructions appearing multiple times
- Density threshold: 2+ distinct boilerplate phrases in a single paragraph, or 4+ across the full text

**WHAT NOT TO FLAG:**
- Common academic phrases that happen to overlap with AI boilerplate when used once (e.g., a single "it is important to note")
- "In conclusion" used once at the essay's end, which is standard student writing
- Balanced argumentation that is genuinely engaging with counterpoints
- Phrases that appear in the author's own writing samples

---

## Profile-Aware Adjustment

When `profile_metrics` are provided with the detection request:

1. **Compare before flagging**: For each signal category, check whether the detected pattern appears in the author's style profile or writing samples.
2. **Suppress matching patterns**: If the author's samples show the same transition density, sentence rhythm, hedging frequency, or abstraction level, reduce that category's contribution by 50-100%.
3. **Voice model override**: If a `voice_model` exists for the profile, treat patterns described in the voice model as authentic. Do not flag them.
4. **Document adjustments**: When suppressing a signal due to profile match, note it in the finding as "matches author profile" rather than silently omitting it.

---

## Score Bands

| Score Range | Label | Interpretation |
|-------------|-------|----------------|
| 0-15 | Clean | No meaningful AI signals. Normal human writing. |
| 16-29 | Minor signals | Isolated or weak patterns. Typical of careful student writing. No action needed. |
| 30-44 | Moderate | Some co-occurring patterns worth reviewing. May reflect formulaic writing habits rather than AI use. |
| 45-64 | Significant | Multiple dense signals across 3+ categories. Warrants close examination. |
| 65-100 | Strong evidence | Pervasive, co-occurring signals across most categories. High likelihood of AI generation. |

---

## Severity Mapping

Each individual finding receives a severity level:

- **`low`**: Weak or isolated signal. Pattern appears but at low density or in a short span. Contributes 1-4 points.
- **`medium`**: Repeated pattern with moderate density across a full paragraph or section. Contributes 5-9 points.
- **`high`**: Dense, sustained pattern co-occurring with other signals. Contributes 10-15 points.

---

## Scoring Rules

- `risk_score`: integer 0-100, computed as the sum of category contributions (each capped at its max)
- `confidence`: **Do not compute.** Return any integer; the platform will replace it with a deterministic score based on text length, flag coverage, NLP measurability, and profile context.
- **Minimum threshold for flagging**: Do not assign `risk_score` > 15 unless at least 2 signal categories contribute independently
- **Convergence requirement**: Do not assign `risk_score` > 40 unless at least 3 signal categories contribute with medium or high severity
- When in doubt, score lower. False negatives are preferable to false positives.
