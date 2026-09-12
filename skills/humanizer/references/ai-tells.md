# AI writing tells — full reference

Source basis: Wikipedia:Signs of AI writing (WP:AISIGNS), adapted for general prose.

These are **observations, not laws**. Human writers do all of these sometimes. The signal is density: many tells, many times, in one piece. Fix the tells; do not mangle sentences that only look slightly like one.

---

## 1. Content-level tells

### 1.1 Puffed-up significance, legacy, and broader trends
AI inflates importance by tying any detail to a bigger story.

Watch for: stands as, serves as, is a testament to, is a reminder that, played a crucial/pivotal/vital/key role, marked a turning point, underscores its importance, reflects a broader, symbolizing its enduring, contributing to the, setting the stage for, marking a shift, evolving landscape, focal point, indelible mark, deeply rooted, cemented its place.

> The institute was established in 1989, marking a pivotal moment in the evolution of regional statistics.

Fix: `The institute was established in 1989.`

Also appears as: placing a subject inside "ongoing debates", or noting it "participated in public discussions". Cut unless the original text actually says what the debate was.

Biology variant: over-linking a species to "the wider ecosystem", and dwelling on conservation status or research efforts that the source never mentioned.

### 1.2 Canned emphasis on coverage and notability
AI proves importance by describing the sources rather than the subject.

Watch for: independent coverage, national/regional media outlets, trade publications, featured in, profiled in, written by a leading expert, maintains an active social media presence, significant and sustained coverage.

Fix: state what the source said, or cut.

### 1.3 Superficial trailing analysis
A present participle clause bolted to the end of a sentence, adding no information.

Watch for: ..., highlighting X. ..., underscoring X. ..., emphasizing X. ..., reflecting X. ..., ensuring X. ..., contributing to X. ..., fostering X. ..., showcasing X. ..., cultivating X. ..., enhancing X. ..., encompassing X. ..., aligning with X.

> The label put her on the cover, underscoring the image it wished to project.

Fix: `The label put her on the cover.` Keep the clause only if it carries a fact stated elsewhere in the original.

### 1.4 Promotional / brochure tone
Watch for: boasts a, vibrant, rich, profound, enhancing, showcasing, exemplifies, commitment to, natural beauty, nestled, in the heart of, groundbreaking, renowned, featuring, diverse array, seamlessly, world-class, state-of-the-art, unwavering, dedication to craftsmanship, refined dynamism.

Applies hardest to places ("rich cultural heritage", "fascinating glimpse"), people, and companies ("emphasized the company's commitment to sustainability").

Newer models are subtler: fewer superlatives, still positive. Watch tone, not just words.

### 1.5 Weasel attribution and overgeneralised opinion
Watch for: industry reports, observers have cited, experts argue, some critics argue, several sources, widely interpreted as, is often seen as, many believe, such as (before a list implied to be non-exhaustive).

Fix: name the actual source if the original names one. Otherwise cut the attribution and state the claim, or cut the sentence.

### 1.6 Challenges-and-future-prospects wrap-up
The formula: "Despite its [good things], X faces several challenges..." then a hopeful close, or a "Future Outlook" section.

Fix: delete the wrap-up. Keep any concrete challenge that was actually named.

### 1.7 Knowledge-gap disclaimers and speculation
Watch for: as of my last update, while specific details are limited, not widely documented, not publicly available, based on available information, in the provided sources, likely, presumably, maintains a low profile, keeps personal details private.

These are almost always invented. Cut them.

### 1.8 Leftover chat-assistant talk
Watch for: Certainly!, Of course!, You're absolutely right, I hope this helps, Would you like me to..., let me know if..., Here is a..., a more detailed breakdown.

Also placeholder text: `[Your Name]`, `(Add your URL here)`, `2025-xx-xx`. And leftover tool markup: `contentReference`, `oaicite`, `turn0search0`, `[cite: 1]`, `[span_1](start_span)`, `grok_card`, `【85†L261-269】`, `[attached_file:1]`, `utm_source=chatgpt.com`.

Cut all of it.

---

## 2. Language and grammar tells

### 2.1 AI vocabulary, by era
One or two words means nothing. Many, repeatedly, is one of the strongest signals.

- **2023–mid 2024 (GPT-4 era):** additionally, boasts, bolstered, crucial, delve, emphasizing, enduring, garner, intricate, intricacies, interplay, key, landscape, meticulous, meticulously, pivotal, underscore, tapestry, testament, valuable, vibrant.
- **Mid 2024–mid 2025 (GPT-4o era):** align with, bolstered, crucial, emphasizing, enhance, enduring, fostering, highlighting, pivotal, showcasing, underscore, vibrant.
- **Mid 2025 onward:** emphasizing, enhance, highlighting, showcasing, plus the notability/coverage phrasing in 1.2.
- **Grok flavour:** causal, empirical, correlate, underscore, "X rather than Y".

Also common in the wild: realm, seamless, leverage (verb), navigate (figurative), harness, embark, unlock, empower, transformative, holistic, myriad, plethora, robust, elevate, streamline, game-changer, deep dive, at its core, in today's world.

Take this literally. A synonym of an overused word is not automatically overused. "Underscore" as a literal underline or a film score is fine.

### 2.2 Copula avoidance
AI dodges plain `is`, `are`, `has`.

| AI shape | Human shape |
|---|---|
| serves as / stands as / functions as / operates as | is |
| represents / marks | is |
| boasts / features / offers / maintains | has |
| refers to (in a definition) | is |
| holds the distinction of being | is |
| ventured into politics as a candidate | was a candidate |
| began his career as | was |

### 2.3 Vague connection language
Watch for: associated with, connected with, in connection with, in association with, linked to, sources identified X as being associated with.

> Sources identified John Doe as being associated with leadership of ExampleCorp.

Fix: `John Doe was CEO of ExampleCorp.` (Only if the original supports it. If the original is genuinely vague, keep it vague but say it plainly.)

### 2.4 Negative parallelism
Three shapes, all overused:

- **Not just X, but Y** — "It's not just a car, it's a statement."
- **Not X, but Y** — "It's not about speed, it's about control." Also "no gimmicks, no filler, just results."
- **X rather than Y** — "prioritizing consolidation rather than ideology."

Fix: say the positive claim on its own. Keep at most one such construction in a long piece, and only if it does real work.

### 2.5 Rule of three
"Adjective, adjective, and adjective." "Short phrase, short phrase, and short phrase." AI uses triples to sound thorough.

> clear, concise, and compelling
> for designers, developers, and product teams

Fix: cut to one or two, or restructure. Break the parallel rhythm.

### 2.6 Stiff word choices
Prefer the plain word: wrote (not authored), used (not utilized), moved (not relocated), tried (not attempted), died (not passed away), before (not prior to), to (not in order to), because (not due to the fact that), about (not with regard to), most (not the majority of), part of (not a part of), so (not as a result of).

### 2.7 Things AI under-uses — put them back
- Plain `is` / `are` / `there is a` / `it has a`.
- Superlatives and definite statements: "the first", "the only", "one of the best" — when true.
- Hedges and intensifiers used naturally: very, perhaps, tends to, pretty much.
- Contractions, in anything but the most formal register.
- Repeating the same word twice when it is the right word. AI does elegant variation to avoid repetition; humans repeat.

---

## 3. Style and formatting tells

- **Title heading** repeating the document's own title at the top.
- **Title Case Headings** where sentence case is normal.
- **Headings that contain only more headings**, no text between.
- **Bold everywhere** — every key term bolded, "key takeaways" style.
- **Inline-header bullet lists**: `- **Thing:** description of thing.` repeated down the page. Turn into prose unless a list is genuinely correct.
- **Em dashes with spaces** — used where a comma, colon, parenthesis, or full stop belongs. Reduce; do not eliminate on principle.
- **Emoji as decoration** in front of headings or bullets.
- **Curly quotes and apostrophes** (" " ' ') where straight ones are normal. Note: publishers and Word do this too, so it proves nothing alone.
- **`---` thematic breaks** between every section (Markdown habit).
- **Unnecessary small tables** for two or three facts that belong in a sentence.
- **Markdown bleeding into a non-Markdown context**: `**bold**`, `# heading`, ` ```code fences ` in plain text or wikitext.

---

## 4. What is NOT a tell — do not "fix" these

Leave these alone. Changing them makes the writing worse for no gain.

- **Perfect grammar and spelling.** Plenty of humans write cleanly.
- **Formal, academic, or fancy prose.** Only the specific overused words are a tell, not formality itself.
- **Bland or dry prose.** AI output skews positive and verbose, not flat.
- **Mixed casual and formal register.** Very human. Common in technical writing.
- **Transition words in isolation.** "Additionally" at the start of a sentence is weak evidence on its own.
- **Any single em dash.** Or any single curly quote.
- **Lists.** Lists are often correct. Only the bold-header-colon formula is a tell.
- **Correct formatting.** Getting markup right is normal.
- **Text written before December 2022.** Cannot be AI.

---

## 5. Rhythm — the tell most people miss

Word swaps alone will not humanize anything. AI's deepest signature is uniform rhythm: sentences of similar length, similar shape, similar opening, evenly sized paragraphs, and each paragraph closing on a neat summary beat.

Fix by:
- Varying sentence length across a wide range. Include at least one very short sentence per paragraph block.
- Varying sentence openings: subject, prepositional phrase, conjunction, subordinate clause.
- Letting paragraph length vary. Two sentences, then six, then three.
- Cutting the tidy closing beat off paragraphs. Human paragraphs often just stop.
- Allowing one small imperfection per few paragraphs: a fragment, an aside, a contraction — matched to the register.
