---
name: humanizer
description: Rewrite text to remove signs of AI writing while keeping the meaning and facts exactly the same. Use when the user says "humanize", "humanize this", "make this sound human", "remove the AI tells", "de-AI this", "make this not sound like ChatGPT", or pastes text and asks for it to be rewritten to read as human-written. Do NOT use for general editing, shortening, translating, or adding new content.
---

# Humanizer

Rewrite the user's text so it does not read as AI-written. Keep every fact and the same meaning. Add nothing new.

## The one hard rule

**Same facts in, same facts out.**

- Do not add a claim, number, name, date, example, or opinion that is not already in the text.
- Do not remove a fact. Cutting AI padding is fine. Cutting information is not.
- Do not change the register the user is writing in (formal stays formal, casual stays casual).
- Keep quotes, code, URLs, and citations exactly as written.
- Keep the user's own voice. This is their writing, not yours.

If a sentence carries no fact at all — pure puffery like "This stands as a testament to its enduring legacy" — delete it. That is removal of noise, not removal of meaning.

## How to run it

1. Read the whole text first. Note the topic, the register, and the audience.
2. Load `references/ai-tells.md` and pass over the text looking for each family of tells.
3. Rewrite. Do not patch word by word — rebuild sentences that are structurally AI-shaped.
4. Check the rewrite against the original fact by fact.
5. Output the rewritten text and nothing else, unless the user asks for notes.

## What to fix

Full checklist with examples is in `references/ai-tells.md`. The short version:

**Content**
- Cut claims of significance, legacy, and "broader trends" ("marking a pivotal moment", "reflects a broader shift", "leaving an indelible mark").
- Cut trailing `-ing` analysis clauses ("..., highlighting its importance", "..., ensuring reliability", "..., fostering growth").
- Cut promo language ("boasts", "vibrant", "rich", "nestled in the heart of", "commitment to excellence", "groundbreaking").
- Cut vague attribution ("experts argue", "observers have noted", "industry reports suggest") unless the source is actually named in the original.
- Cut "Despite these challenges..." and "Future Outlook" style wrap-ups.
- Cut hedge-disclaimers ("it is important to note", "while specific details are limited", "based on available information").

**Language**
- Kill high-frequency AI vocabulary: delve, crucial, pivotal, robust, tapestry, testament, underscore, showcase, foster, garner, intricate, meticulous, landscape (figurative), realm, seamless, leverage (as a verb), navigate (figurative), harness, embark, bolster, elevate, unlock, empower, transformative, holistic, myriad, plethora, additionally (as a sentence opener).
- Put back plain `is` / `are` / `has`. AI dodges them with "serves as", "stands as", "represents", "functions as", "boasts", "features", "offers".
- Kill negative parallelism: "not just X, but Y", "it's not X, it's Y", "X rather than Y".
- Break up the rule of three. AI writes triples everywhere ("clear, concise, and compelling"). Use one or two.
- Use plain verbs: wrote not authored, used not utilized, moved not relocated, tried not attempted, before not prior to, to not in order to.
- Replace vague links ("associated with", "in connection with") with the direct statement.

**Style**
- Remove decorative bold. Keep bold only where the user already used it for real emphasis.
- Remove emoji used as bullets or heading decoration.
- Remove Title Case headings unless the original had them. Use sentence case.
- Remove `---` section dividers.
- Convert "**Header:** description" bullet lists to prose or to plain bullets, unless a list is genuinely right.
- Replace curly quotes and apostrophes with straight ones.
- Reduce em dashes. Use commas, parentheses, or a full stop. Keep at most one or two if the user's own style uses them.

**Rhythm**
This matters more than word swaps. AI writes every sentence to the same length and the same shape.
- Vary sentence length hard. Put a four-word sentence next to a twenty-five-word one.
- Vary sentence openings. Do not start three sentences in a row with the subject.
- Let one paragraph be two sentences and the next be six.
- Allow a light imperfection: a contraction, a short fragment, an aside. Do not force this into formal writing.

## What NOT to do

- Do not add filler like "honestly", "look", "at the end of the day" to fake a human voice.
- Do not add typos or bad grammar. Good grammar is not an AI tell.
- Do not make it more casual than the original.
- Do not shorten to shorten. Length change is a side effect, not a goal.
- Do not add your own opinions, hedges, or conclusions.
- Do not swap an AI word for a fancier synonym. Go simpler, not fancier.
- Do not remove every em dash and every "is" mechanically. Judgment, not find-and-replace.

## Output

Give the rewritten text on its own. No preamble, no "Here is your humanized text", no summary of what you changed — unless the user asks.

If the user asks what changed, then list the tell families you removed, briefly.

If the original contains a fact you cannot express without an AI-shaped phrase, keep the fact and say so in one line after the text.
