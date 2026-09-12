---
name: niche-research
description: Research a niche or industry to find what its operators actually struggle with, then rank the digital products worth building and selling to them — filtering out the vendor pitches and idea-marketing that make raw community data worthless. Use this whenever the user names a trade, industry, or audience and wants to know what to build, what people complain about, where the gaps are, whether an idea has demand, or what would sell — including phrasings like "research the X niche", "what are the pain points in Y", "is there demand for Z", "what should I build for plumbers", "validate this product idea", or "find me an opportunity in home services". Also use it when the user asks about demand vs supply, market saturation, or what competitors don't do. Prefer this over ad-hoc web searching for any product-opportunity question: naive searching returns marketing copy and ranks the most-crowded categories highest, which is the exact failure this method exists to prevent.
---

# Niche pain-point research

Find digital products worth building by comparing what operators say they need against what already exists.

Derived from a live run on home-services digital products (26 Jul 2026). The full source method is in `RedditPainPointResearch-Method.md` at the project root; this skill is that method made executable. Read the source doc only if something here seems ambiguous — this file supersedes it where they differ.

## What separates a good run from a worthless one

Two things, and neither is collection volume:

1. **Filtering vendor noise.** These communities are full of founders pitching tools and doing customer discovery. Unfiltered volume is close to worthless — build the filter before gathering anything. See `references/credibility.md`.
2. **Ranking on the demand-supply gap, not on demand.** High demand with satisfied supply is the worst quadrant, and it is exactly where naive research points. See `references/synthesis.md`.

Everything else is technique.

## Step 1 — Interview

Use `AskUserQuestion` to settle what you can't infer. Ask only what changes the work:

- **The niche**, if not already given. Push for the operator population, not the topic — "people running cleaning companies" is researchable, "cleaning" is not.
- **Depth**: a quick scan (roughly 4–6 threads, one source family) versus a full run (15+ threads across Reddit and forums, with a supply-side scan). Full runs take substantially longer and are worth saying so.
- **Reddit in scope?** Reddit needs the Claude in Chrome extension and a few minutes of setup — see `references/access.md`. Forums work with no setup. Offer both, note that convergence across independent sources is the strongest evidence available, and that a forums-only run cannot demonstrate it.

If the user has already answered these in conversation, skip straight to planning. Don't re-ask what they've told you.

## Step 2 — Plan the queries

**Search the problem, never the product.** "Best CRM for lawn care" returns marketing. "Do I even need a CRM" returns people describing their actual situation. This single choice determines the quality of everything downstream.

Build queries from the phrase bank that produced the best hits on the source run:

```
"built my own"              "too expensive for"
"wish there was"            "how do you handle"
"what actually eats"        "do I even need"
"is that a spreadsheet or"  "I still do it manually"
"paying for features"       "past doing it from memory"
```

The highest-yield thread shape is an open question posed *to* operators — "what quietly costs you the most time or money?" These massively outperform tool-comparison threads, because people answer with their real day instead of a product name.

**Mine comments, not posts.** Nearly every usable quote on the source run came from replies. The post is just the fishing line.

## Step 3 — Choose sources

**Verify the community is operators, not hobbyists.** r/lawncare is homeowners discussing their own grass; r/cleaningbusiness is people running companies. Same topic, entirely different signal. Check a few titles before investing queries in a source.

**Search site-wide before assuming a home.** The single richest thread on the source run was in r/CRM — not in any trade sub — a solo operator asking which CRM to buy, answered by twenty people. Let search tell you where the conversation lives.

**Trade forums are first-class sources, not fallbacks.** ContractorTalk, LawnSite, CleaningTalk. Higher operator density, far less vendor noise, and reachable with plain `WebSearch`/`WebFetch`. Nearly every trade has an equivalent forum — find it for the niche at hand.

**Reviews are demand data.** One- to three-star reviews of existing products are the cleanest available statement of "what exists fails at X."

**Confirm a source is populated before building a query set against it.** r/lawncarebusiness returned zero results for every query on the source run.

## Step 4 — Collect

Forums: `WebSearch` with `site:` scoping to find threads, then `WebFetch` to pull them.

Reddit: read `references/access.md` first. It has the access matrix (most routes are blocked — do not rediscover this), the extension preflight check, the URL patterns that work, and the SPA navigation trap that otherwise eats several rounds.

Capture quotes verbatim as you go, with author and thread. Resist the urge to summarize during collection — paraphrase destroys exactly the operational specificity that Step 5 scores on, and a paraphrased quote can't be quoted in the report.

Track roughly how many independent sources each recurring complaint appears in. That count is the input to the strongest signal in the whole method.

## Step 5 — Filter

Read `references/credibility.md` and apply it to everything collected. This is the step that decides whether the output is worth anything.

Report contamination honestly in the final deliverable: name which threads were vendor-heavy and whose comments you weighted. The user needs to know the raw material wasn't clean.

## Step 6 — Synthesize and deliver

Read `references/synthesis.md`. It covers the demand-supply gap, the trap that catches naive research, the scoring dimensions, and the report template.

Write the report to a file in the project (`<niche>-opportunities.md`) rather than only into the conversation — these are documents the user compares across niches over time. `DigitalProducts-HomeServices-Summary.md` at the project root is the reference for what good output looks like.

## What to tell the user at the end

State plainly which numbers are inferred rather than verified, and how to spot-check them. Every price band in this kind of research comes from listing prices, not revenue — no marketplace publishes real sales data. Reddit and forums skew toward the vocal and the newly-struggling; operators who solved a problem quietly aren't posting. Say so.
