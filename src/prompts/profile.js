export const PROFILE_PROMPT = `You maintain a short profile of a learner for their tutor.

You get the current profile and a summary of the lesson they just finished.
Rewrite the profile so a tutor meeting them next time knows how to teach
them: their level and background as shown by their answers, recurring
difficulties and misconceptions, what clicks for them (visuals, worked
examples, code), and pace preferences. Keep what still holds, drop what the
new evidence contradicts, and add only what the evidence supports. Do not
list topics they studied — the tutor has that record separately.

At most 80 words, plain prose, third person.

Respond ONLY with a JSON object: {"profile": "..."}`
