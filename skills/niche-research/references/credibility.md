# Credibility filtering

This is the step that decides whether the research output is worth anything.

You are not judging whether a comment is well written, agreeable, or upvoted. You are judging one thing: **how much weight should a researcher put on this as evidence about real operational pain?**

These communities are heavily contaminated. On the source run, one r/CRM thread contained roughly six vendors pitching their own products, some disclosed and some not. Two r/cleaningbusiness threads had original posters who were themselves building tools and asking leading questions to validate them. A tool that skips this step produces a confident ranking of marketing copy.

## Weight these heavily

**Operational specificity.** Does the person describe their own business with detail only someone running it would produce? *"If one person is out on a 3-person crew they can throw a whole night off."* You cannot fake that from the outside. The test is whether an outsider could have written it.

**Specific numbers attached to real consequences.** Hours, dollars, margins, headcount, turnover — that the person evidently tracks and that cost them something. *"Three of our fourteen sites are underwater right now and two of those I would not have guessed."* A number with a consequence beats a number alone, which beats no number.

**Naming a specific paid tool's boundary.** The highest-value comment shape in the entire corpus. *"Jobber at $49/month handles quoting, scheduling and invoicing, but it does not calculate actual job costs."* One sentence locating precisely where the paid market stops is worth more than fifty upvotes of general complaining — it hands you the product.

**Structural insight** — an observation about *why* a problem persists rather than that it exists. *"Owners switch tools twice and keep the same chaos both times because the record standard never existed."* Rare, and usually the most valuable thing in a run.

**"I built my own."** Someone who built a workaround has already priced the pain in their own time.

**Unprompted convergence.** The same complaint appearing across independent communities, unprompted, in different words. This is the strongest signal available and it is what justifies a top recommendation. It's a corpus-level property, not a per-comment one — track it as you collect.

## Discount these

**Undisclosed vendors.** The tell is structure, not content: a plausible observation that pivots to a product, an origin story ending in "link in profile", "DM me", "happy to give forum members a trial", a username matching a product name, or first-person-plural about a tool ("we built", "we love it"). A comment can be entirely accurate and still be marketing. Judge what it is, not whether it's true.

**Affiliate and referral links**, free-audit offers, lead magnets, "full breakdown in my newsletter".

**Idea-marketing.** The "I found 3 micro-SaaS ideas from real complaints" genre. These *look* like research and are content marketing. They contain no primary evidence — they are someone else's unfiltered output, which is the exact thing this method exists to avoid consuming.

**Listicles and rankings** of any kind.

**Answers given to an OP who is visibly doing customer discovery.** When the framing is "what's your biggest problem, I'm building something", replies are agreeable and shaped by the question. The respondent may be a genuine operator and the answer still carries little weight. Discount the reply because of the thread it sits in.

**Wrong audience.** Verify the speaker is an operator, not a consumer. A homeowner discussing what they pay their lawn guy is a different population from someone running a lawn care company, even in a thread on the same topic.

**Platitudes.** "Be consistent and the money follows." True, generic, no evidence.

## Partial credit

A **disclosed** vendor is not an undisclosed one. Someone who says *"I sell SOP templates, so discount me accordingly"* and then makes a self-critical observation about their own category has given you something usable. Weight it in the middle, flag the interest, don't zero it.

A real operator making a thin remark ("I use Jobber, it's fine") is genuine but low-information. Middle of the range — the bottom of the range is for marketing and wrong-audience content, not for brevity.

## Calibration

Worked examples. The hard cases are the ones where surface features point the wrong way.

| Comment | Call | Why |
|---|---|---|
| *"Jobber at $49/month handles quoting, scheduling and invoicing, but it does not calculate actual job costs and you still need to estimate manually."* | **Trust, top of range** | Names a paid tool's exact boundary. This is the product brief. |
| *"Guys think they're at 35% profit but only bank 12%. You are not counting your own labor, your truck, or the drive time."* | **Trust** | Numbers tied to a consequence, insider detail. |
| *"Spreadsheets work until they don't! Once you're past 5 clients you need real software. SparkleSuite starts at $29/mo…"* — author `SparkleSuite_Team` | **Discount** | Username matches the product. Opening observation is reasonable and irrelevant. |
| *"Honestly a spreadsheet gets you 70% there but it breaks past one crew. That's exactly why we built TurfPilot."* | **Discount** | Concern-then-pitch. The concern is real; the comment is an ad. |
| *"Definitely scheduling! And invoicing. Would 100% pay for something that did both."* — replying to *"What's the biggest problem in your cleaning business? Trying to build something useful"* | **Discount** | Possibly a real operator, but the thread framing produced the answer. Leading questions produce agreeable answers. |
| *"My guy charges $45 for about a quarter acre and does a decent job."* in r/lawncare | **Discount** | Homeowner, not operator. Wrong population entirely. |
| *"I sell SOP templates, so discount me accordingly. But people buy a template and never adapt the parts specific to how they work, so it sits unused."* | **Middle** | Disclosed interest, and self-critical about their own category. Usable. |
| *"I use Jobber. It's fine."* | **Middle** | Real operator, almost no information. Thin, not fraudulent. |
| *"Been doing this 34 years without software and I'm not starting now."* | **Middle** | Genuine, but nothing transferable to act on. |
| *"I built my own in Airtable over three weekends. Not because Airtable is better than Jobber but because I finally had to decide what a client record contains, and that decision was the actual work."* | **Trust, top of range** | Built-my-own plus structural insight. Note "built" also appears in vendor pitches — the surrounding structure is what distinguishes them. |

`calibration-set.json` in this directory holds 52 labelled examples in the same spirit, 10 of them verbatim from the source run. Consult it if you want more coverage on a case you're unsure about, or as a self-check after tuning anything in this file.
