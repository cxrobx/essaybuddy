# AI Pattern Detection Rubric

Use this rubric to score how likely text is to trigger AI detectors.

## Signals

1. Repetition and syntactic uniformity
- Repeated sentence templates
- Low variation in openings and cadence

2. Hedging and generic generalization
- Abstract statements with weak specifics
- Overuse of broad qualifiers without evidence

3. Over-structured transition cadence
- Mechanical transition chains (`however`, `moreover`, `therefore`) in unnatural density

4. Low-variance sentence rhythm
- Similar sentence lengths across long spans
- Flat punctuation patterns

5. Generic abstraction vs concrete detail
- Claims without grounded examples, entities, or timelines

6. Meta-AI phrasing indicators
- “As an AI...”, “in today's world...”, or common model-like boilerplate

## Severity Mapping

- `low`: weak signal or isolated pattern
- `medium`: repeated pattern with moderate confidence
- `high`: dense, multi-signal pattern and strong confidence

## Scoring

- `risk_score`: integer 0-100
- `confidence`: integer 0-100
- Use score bands:
  - 0-34 => low
  - 35-69 => medium
  - 70-100 => high
