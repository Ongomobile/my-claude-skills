---
name: productize
description: Package an app or tool as an AI Creators' Workshop product with branded HTML instruction docs, LICENSE, assets, and delivery zip. Use when the user says "productize X", "make X a product", "add it to the Products folder", "create the branded docs/instructions", or wants a new product to match the existing ones. Also use to restyle or add a single branded doc to an existing product.
user-invocable: true
---

# Productize: AI Creators' Workshop product packaging

Turn an app into a sellable product folder that matches every other product in
`/Volumes/My Mac Drive/AI Creators Workshop /Products/` (note the trailing space
after "Workshop "). The gold-standard reference is `Products/social-media-starter-kit/`
— when in doubt, open its docs and copy what it does.

## Ask this first

**Paid or free?** Ask before you write a single doc. It decides the LICENSE, and
it changes the wording in README and START-HERE. Getting it wrong means writing
both.

| | Paid product | Free giveaway |
|---|---|---|
| LICENSE | `templates/LICENSE-template` | `templates/LICENSE-giveaway-template` |
| README rights table | what a buyer may do with it | free to pass on, not for resale |
| Framing | "what you may do with it" | "this folder is the kit it was built from" |
| Footer / fine print | standard | "Free to read. Free to pass on. Not for resale." |
| Needs | a price and a sales page | one public URL that opens on a phone with no login |

If the user has not said, ask them in one line. Do not guess and do not build
both. A guide or field guide is usually free and sells the workshop behind it.
An app, tool, or starter kit is usually paid.

## Product folder anatomy

```
Products/<product-name>/          kebab-case, no "-product" suffix for new products
├── <the app itself>              source, build folders, whatever the product is
├── START-HERE.html               orientation doc (always)
├── README.html + README.md       product guide (always; md twin for GitHub/Claude)
├── <SETUP|X-SETUP>.html + .md    one per real setup task (only if needed)
├── LICENSE                       from templates/LICENSE-template
└── assets/
    ├── logo-circular.png         from this skill's assets/
    └── paper-texture.svg         from this skill's assets/
Products/<product-name>.zip       delivery zip, sibling of the folder
```

Never include `.git`, `.claude`, `.DS_Store`, or `node_modules` in the product
copy or the zip. If the app has its own dev repo elsewhere, COPY into Products;
leave the original untouched as the dev home.

## The branded doc template

Every HTML doc is a single self-contained page built from
`templates/doc-template.html` (inline CSS, Google Fonts Inter + JetBrains Mono,
favicon + nav logo = `assets/logo-circular.png`, paper-texture body background).
Replace the `{{PLACEHOLDERS}}`, delete the section types you don't use, keep the
CSS block byte-identical across docs so the suite feels like one product.

Section vocabulary and when to use each:

| Piece | Use for |
|---|---|
| `.nav` with `.nav-tag` | START-HERE only (tag text: "Start Here") |
| `.nav` with `.back` link | every other doc, linking back to START-HERE.html |
| `.hero` | every doc: eyebrow "AI Creators' Workshop · <context>", h1 with exactly ONE orange `<span>` phrase, 2–3 sentence sub |
| `.part` + `.part-num` | every major section, numbered 1..n with outlined numerals |
| `.steps` / `.step` | any ordered procedure (sticker-shadow cards) |
| `.body` | free prose, lists, h3 + `pre` command blocks |
| `.note` (+ `.warm`) | asides; warm variant for cautions |
| table | the "I just want to..." jump table (START-HERE always has one) and structure/reference tables |
| `.dark-panel` | ONE per product: the single most important warning ("The one thing that matters most") |
| `.footer-note` | closing line; default copy points the buyer at Claude Code for help |

## Doc set decision guide

- **Simple product** (single file, no accounts to create): START-HERE.html,
  README.html/.md, LICENSE. Fold small optional setup into a START-HERE section.
- **Complex product** (Firebase/Cloudflare/Sheets accounts, deploys): add
  SETUP.html/.md, and split further (OWNERS-GUIDE, RESKIN-CHECKLIST,
  X-SETUP) only when one doc would exceed ~6 parts.
- Every HTML doc gets a same-named `.md` twin with the same content in plain
  markdown (buyers open HTML; Claude Code and GitHub read the md).
- Cross-link: START-HERE's path section links each doc; each doc's nav links
  back. Verify every relative href resolves before shipping.

## Steps

1. **Copy the app** into `Products/<name>/` (exclude the junk list above).
2. **Copy assets** from this skill's `assets/` into `Products/<name>/assets/`.
3. **LICENSE**: pick the one that matches the answer to "paid or free".
   - Paid: `templates/LICENSE-template`. Replace `{{PRODUCT_NAME}}` with the
     Title Case product name and `{{YEAR}}` with the current year.
   - Free: `templates/LICENSE-giveaway-template`. Replace
     `{{PRODUCT_NAME_UPPER}}` with the product name in caps, `{{YEAR}}`,
     `{{THING}}` with what it actually is ("guide", "kit", "template"), and
     `{{RESULTS_LINE}}` with one honest sentence about what the results depend
     on and what the reader must check themselves.
4. **Write the docs** from `templates/doc-template.html`. Reuse any good
   existing content (an old README.md is usually the raw material for
   README.html). Update md twins to match.
   **Write the prose to the humanizer rules the first time** (see Voice below).
   Do not draft it loose and clean it up afterwards. Once the copy is inside
   HTML, markdown twins and a rendered PDF, one wording change has to be made in
   four places.
5. **Verify in a browser**: logo and texture render, all links resolve, the
   app itself still opens/runs from the new location.
6. **Zip** from the Products folder:
   `zip -r <name>.zip <name> -x "*.DS_Store" -x "*node_modules*" -x "*/.git/*"`

## Voice (Mike's)

Short, declarative, peer-to-peer. Second person. Confident expertise with
inclusive warmth. The reader is a non-developer building real things.
Headlines state a benefit plainly: "A complete little social app you make your
own." Explain the why in one line, then get out of the way. For deeper brand
work (colors, type ramp, components) see
`/Volumes/My Mac Drive/AI Creators Workshop /ACW Design System/`.

**Apply the humanizer rules while you draft, not after.** Read
`~/.claude/skills/humanizer/references/ai-tells.md` before writing the first
doc, and write to it. The short version:

- No em dashes. No curly quotes. Straight apostrophes only
- No SaaS slop: unlock, supercharge, seamless, leverage, empower, robust,
  crucial, elevate, streamline, transformative, delve, showcase, foster
- Plain `is` and `has`, not "serves as" / "stands as" / "represents"
- No negative parallelism ("not just X, but Y")
- No trailing analysis clauses (", highlighting its importance")
- No rule-of-three padding. One or two items, not three
- No decorative bold, no emoji bullets, no Title Case headings
- Vary sentence length hard. A four word sentence next to a twenty-five word one

Deliberate repetition is not a tell. "One offer. One price. One link." is
rhetoric and it stays.

**Verify before zipping**, from inside the product folder:

```bash
grep -oniE "\b(delve|crucial|pivotal|robust|testament|underscore|showcase|foster|seamless|leverage|harness|embark|elevate|unlock|empower|transformative|myriad|vibrant|utilize|streamline)\b" *.md *.html
grep -c -- "—" *.md *.html | grep -v ":0"
grep -on "[’‘“”]" *.md *.html | grep -v "Creators’"
```

All three should come back empty. The curly-quote check ignores `Creators’`,
which is correct in the brand name.

## Ship checklist

- [ ] Paid or free settled before drafting, and the LICENSE matches
- [ ] Folder + zip in Products, no junk files inside
- [ ] START-HERE.html, README.html/.md, LICENSE present; setup docs if needed
- [ ] assets/logo-circular.png + paper-texture.svg copied; favicon works
- [ ] Every internal link clicks through; app runs from the new location
- [ ] One dark-panel warning, one orange span per h1, md twins in sync
- [ ] Voice checks clean: no AI vocabulary, no em dashes, no curly quotes
- [ ] Original dev repo untouched
