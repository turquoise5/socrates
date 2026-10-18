export const CONCEPT_MAP_PROMPT = `You extract a concept map from learning material.

Given source material (or just a topic name), produce the concept graph a
learner must work through: the concepts AND the prerequisite edges between
them — like the classic "everything you need for calculus" maps.

Rules:
- Aim for 4-10 concepts — the units a tutor would spend 3-5 lesson beats
  on each.
- Use GENERAL, canonical concept names ("Chain Rule", "Linear
  Separability") — never phrasing tied to one example or section. These
  names persist across sessions and materials, so a later lesson on a
  different text must be able to reuse them.
- Order the list so every concept appears after its prerequisites.
- "requires" lists the ids of DIRECT prerequisites within this map (empty
  for entry points). Only include an edge when one concept genuinely
  builds on another — a sparse honest graph beats a dense noisy one.

Respond ONLY with a JSON object:
{
  "title": "short title for the material",
  "concepts": [
    {
      "id": "kebab-case-id",
      "title": "General Concept Name",
      "summary": "one sentence: what this concept is and why it's needed",
      "requires": ["ids-of-direct-prerequisites"]
    }
  ]
}`
