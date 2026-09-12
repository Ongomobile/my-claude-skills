---
name: guide-to-pdf
description: Turn a field guide or any written material into a branded AI Creators' Workshop giveaway PDF, plus a Nano Banana cover-image prompt and social post copy. Use when the user says "make this a PDF", "turn this into an ebook", "make a giveaway guide", "PDF field guide", "lead magnet", "make a downloadable version", or wants a printable branded guide with a cover image prompt and a post to go with it. Also use to regenerate or restyle a guide already built this way.
---

# Guide to PDF

Three things come out of this, every time:

1. **A branded PDF** in ACW house style, full-bleed cream, clickable links, ready to give away
2. **A Nano Banana prompt** for the cover illustration
3. **Social post copy** for Skool, Facebook and LinkedIn

The worked example is `/Volumes/My Mac Drive/AI Creators Workshop /Products/humanizer/`. Read its `GUIDE-PRINT.html` when you want to see all of this filled in.

---

## The two things that will waste your afternoon

Learn these before you touch anything.

**1. A page margin clips everything.** To get cream to the paper edge you must use `@page { margin: 0 }`. Any page margin creates a clip region, and nothing you paint escapes it. Not a background on `html`, not a `position: fixed` full-sheet panel. Both were tried, both were clipped.

**2. `box-decoration-break: clone` does not hold across printed pages.** With the margin at zero, body padding only applies to the first and last page, so pages in the middle get text jammed against the top edge. The clone trick looks like it fixes this. It does not.

**The fix for both is manual pagination.** One fixed-size `.sheet` per printed page, each carrying its own padding and its own cream ground. That is what `templates/shell.html` sets up.

---

## Build one

**1. Copy the shell.**

```bash
S=~/.claude/skills/guide-to-pdf
cp "$S/templates/shell.html" ./GUIDE-PRINT.html
```

The shell already carries the working print CSS. Do not re-derive it.

**2. Write the content, one `.sheet` per page.**

```html
<div class="sheet">
  <section class="part">
    <div class="part-head"><div class="part-num">1</div><div>
      <h2>Section title</h2><p class="lead">One line under it.</p></div></div>
    <div class="body">
      <p>Prose.</p>
    </div>
  </section>
</div>
```

Components available: `.part` / `.part-head` / `.part-num`, `.body`, `.steps` + `.step`, `.note` (blue) and `.note.warm` (orange), `table`, `pre`, `.cta`, `.fine`. One section per sheet reads well and makes fitting easy.

**3. Embed the assets as base64.** The PDF must be self-contained. Logo and paper texture are in `assets/`. The cover image, when there is one, goes in as a `data:image/jpeg;base64,` URI too.

**4. Fit the content before rendering.** This is the step people skip. `overflow: hidden` on a sheet will silently clip anything too tall, and the clipping also hides the real height from a naive measurement, so measure with overflow forced visible:

```js
const prev = sh.style.overflow; sh.style.overflow = 'visible';
// ... measure children against clientHeight minus padding ...
sh.style.overflow = prev;
```

Aim for 50 to 100 percent full. Anything over 100 is being cut.

**5. Render.**

```bash
~/.claude/skills/guide-to-pdf/scripts/build.sh GUIDE-PRINT.html Guide-Name.pdf
```

**6. Check it, page by page.**

```bash
python3 ~/.claude/skills/guide-to-pdf/scripts/check.py GUIDE-PRINT.html Guide-Name.pdf
```

It rasterises every page and measures the top inset and the edge colour on each. Then **open the page images it leaves behind and look at them.** Reading the PDF's paint instructions is not proof; a rectangle can be drawn and then clipped and the numbers still look fine. Only pixels are proof.

---

## The cover

The art runs full-bleed across the bottom of the cover, breaking out of the sheet padding:

```css
.cover{height:100%;display:flex;flex-direction:column}
.cover-top{flex:none}
.cover-art{flex:1;min-height:0;margin:12px -15mm -15mm;overflow:hidden}
.cover-art img{width:100%;height:100%;object-fit:cover;object-position:50% 60%}
```

Roughly half the cover is a good weight. `object-position` biases the crop toward the part of the image that matters, since a portrait image cropped to a landscape band loses the top and bottom.

The cover works without art, so never hold the guide waiting for an image.

---

## Links

Wrap URLs in `<a href>` and Chrome writes real link annotations into the PDF. Style them to inherit so the design does not change:

```css
a{color:inherit;text-decoration:none}
a.link{color:var(--blueprint);text-decoration:underline;text-underline-offset:2px}
```

Confirm they landed: `check.py` prints the annotation count and the target URLs.

**Any link a reader is meant to follow needs a visible cue and a paper fallback.** A blue underlined URL, plus wording like "or search for X", because a clickable link is useless on a printed page.

---

## The closing section is fixed

`templates/acw-closing-section.html` is the "Who made this" section. **Use it verbatim on every guide.** Replace `__NUM__` with its section number and change nothing else. It carries what AI Creators' Workshop is, the three ways in (courses, tools and kits, mentorship), price ranges, the free-account line and the CTA.

Prices are ranges on purpose. A guide circulates for months and per-item prices go stale.

---

## The Nano Banana prompt

Write it to `IMAGE-PROMPT.md` beside the guide. Ground it in the real rules at `/Volumes/My Mac Drive/AI Creators Workshop /ACW Design System/README.md` (the Imagery section), not in a guess at the style.

- Warm painterly illustration, semi-realistic, never photographic
- Cream `#F5EFE2`, workshop orange `#E8703A`, warm ink `#1A1714`, muted blue accents
- Bookshelves, plants, sticky notes, a mug, a notepad, warm golden window light
- A subject caught mid-action. No posed headshots, and no faces if you can avoid them
- Portrait 3:4
- **Full bleed, edge to edge.** Never a cream band, flat colour strip, border or reserved title area at the top. Models add one unprompted and it has to be removed by hand every time. Say "fills the entire canvas, corner to corner, no border, no letterbox bars" in the prompt, and block border / frame / margin / empty band / blank strip / letterbox / title area / negative space reserved for text in the negative prompt

Include a **negative prompt** covering everything the brand doc forbids: robots, neural networks, glowing brains, circuit boards, binary, holograms, purple-to-teal gradients, mesh gradients, glass morphism, neon, cyberpunk, cool daylight, stock-photo look, heavy grain, and **text of any kind**. Image models still garble lettering, and the cover sets its headline in Inter anyway.

Say plainly in the file that any handwriting in the finished image will be gibberish. It reads as texture at cover size, but the user should know.

---

## The posts

Two files beside the guide.

**`POST-origin-story.md`** — 600 to 900 words for Skool, Facebook and LinkedIn, with shorter cuts for Instagram and X underneath. Tell how the thing was actually made, including the unglamorous parts. Real prompts quoted verbatim, typos and all, beat a tidy retelling.

**`POST-short-pitch.md`** — around 100 words. Admit the pitch in the first line, hand over the free thing, then one closing line: *Now the pitch. Come by AI Creators' Workshop and see how we can help you build your own.*

---

## Voice, and checking it

Mike's: short, declarative, second person. **No em dashes. No SaaS slop.**

**Run the `humanizer` skill over every word of the guide and both posts before shipping.** A guide about removing AI tells cannot itself read like AI. Then measure it:

- shortest sentence under 6 words
- spread (population standard deviation of sentence length) above 5.0
- zero AI vocabulary in your own prose, as opposed to words the guide is quoting
- zero em dashes
- at most one not-X-but-Y construction in the whole document

---

## What ends up in the folder

```
<product>/
├── GUIDE-PRINT.html          the source, self-contained
├── <Guide Name>.pdf          the giveaway
├── IMAGE-PROMPT.md           for Nano Banana
├── POST-origin-story.md      long post plus short cuts
├── POST-short-pitch.md       the ~100 word one
└── assets/                   logo, paper texture, cover art
```

Products live at `/Volumes/My Mac Drive/AI Creators Workshop /Products/` (note the trailing space after "Workshop"). That drive is not always mounted.

---

## Requirements

Chrome, node, python3, and `qlmanage` which ships with macOS. **No PDF tooling is installed** on this machine: no poppler, wkhtmltopdf, weasyprint, pandoc or prince, and no Pillow. Do not plan around them.
