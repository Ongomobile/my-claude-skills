---
name: design-studio
description: Build websites, design systems, and multiple design directions with Claude Design (the /design canvas) using a three-level workflow — Level 1 a fast first site from a product, Level 2 a reusable design system built from a visual reference, Level 3 several rival directions on one artboard so a human picks the winner. Use when the user says "design studio", "build me a website design", "make a design system", "design mockup", "give me three versions of this site", "make this look like [reference]", "brand system for a client", or hands over a product page, product photo, or a Dribbble/Behance/Pinterest screenshot and wants a designed page from it. Not for coding a live production site — this produces editable canvas designs, PNG/PDF/HTML exports, and a reusable system.
---

# Design Studio

A repeatable way to turn a product plus a visual reference into a real brand: a
design system, a website, and several rival directions the human chooses between.

Everything here runs through the built-in `design` skill, which publishes a
pan/zoom canvas of `.dc.html` artboards the user can edit by hand — click an
element, change font, size, weight, colour, alignment — and export as PNG, PDF,
or an HTML zip.

## The core idea

Most people run `/design`, take the first thing that appears, and stop. That
wastes the tool. The value is in three levels, run in order:

| Level | What it makes | Why it matters |
|---|---|---|
| 1 | One site, fast, from the product | Proves the concept in minutes |
| 2 | A **design system** from a visual reference, then the site rebuilt to fit it | The system is a file on disk — reuse it forever |
| 3 | Two or three rival directions on **one artboard** | The human picks the winner instead of settling |

Do not skip Level 2. The design system is the asset. The website is disposable.

## Step 0 — One folder per client

Claude Design writes files into the working folder. Keep each brand separate so
its system never mixes with another's.

```bash
mkdir -p ~/Desktop/design/client-one
```

One folder per client or project. `client-two` gets its own folder and its own
system. Confirm with the user which folder to work in before building anything.

## Step 1 — Gather the two inputs

Ask for both. Do not start without them.

**Input A — the product.** A product photo plus its copy. If the user gives a
URL, save the product image into the client folder so the design can place the
real product, not a placeholder:

```bash
curl -L -o ~/Desktop/design/client-one/product.jpg "<image-url>"
```

Also capture the product's name, claims, ingredients, price, and any existing
copy. Paste it into the prompt as plain text.

**Input B — a visual reference.** Claude Design works far better with a picture
of the look you want than with adjectives. Send the user to:

- dribbble.com → Explore → Web Design
- behance.net
- pinterest.com

They screenshot one shot they like and drop the image into the chat. If the user
resists, ask instead for two or three named brands whose look they want, but say
plainly that an image gets a better result.

## Step 2 — Level 1: the first site

Invoke the `design` skill. Prompt shape:

```
Build me a beautiful website for the product in this folder.
Here are the details about it:
<paste the product name, claims, ingredients, price, and copy>
```

Expect a desktop and a mobile artboard on the canvas, with real copy, the real
product image, and CTAs.

Then show the user the three things they can do to it, because most people miss
these:

1. **Side panel** — click any element and edit it directly: font, size, weight,
   colour, alignment. This is the Figma-replacement part.
2. **Tweaks** — live user controls on the design. If the user does not know what
   controls to ask for, prompt: `Suggest some tweak controls I can add to this
   design.` Typical good ones are an accent-colour picker with curated swatches
   and a dark-mode toggle. Then say `Add those.`
3. **Export** — the download arrow gives PNG, PDF, or an HTML zip, per artboard
   or all artboards as one PDF.

## Step 3 — Level 2: the design system

This is the step that turns a one-off page into a brand.

Have the user paste the reference image into the chat, then run:

```
Create a design system HTML based on this reference.
Then create a V2 of our <brand> website to fit the system.
```

The system artboard should contain, at minimum:

- The full colour palette, with hex values
- The type scale — every heading and body size
- The font pairing, including any display or script face
- Buttons and components in each state
- Any signature treatment (highlighted text, rules, badges)

The system file lands in the client folder. Say this out loud to the user: it is
now reusable. Every future website, Instagram carousel, slide deck, or ad for
this brand should start by pointing at that file:

```
Use the design system in this folder. Build me <the new thing>.
```

## Step 4 — Level 3: rival directions

Never hand over one option. Run:

```
Make me two more versions of the site. They should have different copy and
different layout. Be creative. Show all three desktop versions on a single
artboard.
```

The point is genuine difference, not three shades of the same page. Each version
should target a different audience or a different pain point, with its own
headline, its own messaging, and its own visual approach. Check the result — if
the three look like the same layout recoloured, push back with a more specific
prompt naming the three audiences.

Every version stays editable in the side panel. Present all three to the user and
let them choose. That choice is the human's job, not yours.

## Step 5 — Hand off

The published canvas is a link. Anyone the user shares it with can open it, make
edits, and leave feedback, so this doubles as the review step with a boss, a
client, or a team.

Close by telling the user:

- Which folder the design system lives in
- The exact sentence to reuse it next time
- Which export format fits what they said they need

## Notes that change the output quality

- **Model.** The most creative model gives the best design thinking. Suggest
  Fable if the user has it available.
- **References beat adjectives.** "Make it premium" gives noise. A Dribbble
  screenshot gives a result.
- **Real product image, always.** Save it into the folder first. A design with a
  placeholder box is not a design the user can show anyone.
- **The folder is the memory.** Nothing is reusable unless it is written into the
  client folder.
