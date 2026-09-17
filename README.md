# my-claude-skills

My portable Claude Code setup: skills, slash commands, and output style.

## What is in here

| Folder | Goes to | What it is |
|---|---|---|
| `skills/` | `~/.claude/skills` | 15 skills |
| `commands/` | `~/.claude/commands` | slash commands |
| `output-styles/` | `~/.claude/output-styles` | the ELI5 style |

## Skills

Run any skill by typing `/` and its name, or just ask for the thing it does and Claude picks it up. When you add a skill, add a row here.

### Websites and design

| Skill | What it does | Say something like |
|---|---|---|
| `design-studio` | Designs sites and design systems in Claude Design: a quick first site, a reusable design system from a reference, or several rival directions to pick from. Canvas designs, not live code. | "Give me three versions of this site" |
| `scrollcraft` | Builds a premium scroll-driven landing page: video that scrubs as you scroll, pinned sections, sideways rails. Interviews you first, then generates or uses your assets. | "Make my brand a scroll experience" |
| `mobile-microsite` | Builds a mobile-first scroll-film site that plays like one continuous shot, for a known brand or as a spec site to pitch a prospect. | "Build a spec site for a local roofer" |
| `sheet-form` | Wires a simple form (contact, enquiry, waitlist) to a Google Sheet with emails sent from Gmail. | "Make a contact form that goes to a spreadsheet" |
| `list-engine` | Step-by-step build of a signup form: Google Sheet, instant email from the client's domain through Resend, optional downloads on Cloudflare R2, owner notices, unsubscribe, list emails written in the Sheet, Turnstile, DMARC. Sold as the List Engine product. | "Set up a form that emails a free PDF guide" |
| `calendar-booking` | Step-by-step build of a branded booking modal that replaces Calendly or Setmore: instant booking on the owner's Google Calendar with a Meet link and invite, heads-up email, Sheet row, hours and days off edited in the Sheet, Turnstile. Includes an owner guide. | "Replace Calendly with a booking calendar on my site" |

Which form skill? Use `sheet-form` when only the owner needs an email. Use `list-engine` when subscribers get email from the business's own domain, downloads, or an unsubscribe link.

### Content and products

| Skill | What it does | Say something like |
|---|---|---|
| `acw-reel` | Makes a branded AI Creators' Workshop vertical reel (1080x1920 MP4) in the light or dark theme. Can show an app being tapped through on a phone, and recut a reel for clients. | "Make a reel about this AI trick" |
| `guide-to-pdf` | Turns a guide or notes into a branded AI Creators' Workshop giveaway PDF, with a cover image prompt and a social post. | "Turn this into a giveaway PDF" |
| `productize` | Packages an app or tool as an AI Creators' Workshop product: branded instruction docs, license, assets, delivery zip. | "Productize this tool" |
| `humanizer` | Rewrites text so it stops sounding AI-written, keeping the meaning and facts the same. | "Humanize this" |

### Research

| Skill | What it does | Say something like |
|---|---|---|
| `deep-research` | Researches a topic across many sources, rates source quality, cross-checks facts, and writes a structured report. Modes: quick, standard, thorough, angles. | "Research how X works, thorough" |
| `niche-research` | Finds what people in a trade actually struggle with and ranks digital products worth building for them, filtering out vendor marketing. | "What should I build for plumbers?" |

### Workflow

| Skill | What it does | Say something like |
|---|---|---|
| `fable-goal` | Turns a rambling idea into one polished `/goal` prompt for Fable to build in a fresh session. Writes the prompt, not the build. | "Write me a Fable prompt for this" |
| `session-handoff` | Writes an end-of-session summary (decisions, changes, key files, open questions) so a fresh session can pick up where you left off. | "Wrap up the session" |
| `skool-course-offline` | Saves a Skool classroom course for offline reading: every lesson as local HTML and Markdown, images included. | "Make this Skool course offline" |

### Slash commands

| Command | What it does |
|---|---|
| `/create-landing-page` | Builds a single-file client landing page from a business document, with StoryBrand copy and JSON content ready for Decap CMS. |
| `/cms-setup` | Adds Decap CMS to an existing landing page so the client can edit content without touching code. |

### Output style

| Style | What it does |
|---|---|
| `ELI5` | Plain, short answers in Simplified Technical English. Choose it as the output style in Claude Code settings when you want everything explained simply. |

## Set up on a new Mac

Clone it, then link the three folders into `~/.claude`.

```bash
git clone https://github.com/Ongomobile/my-claude-skills.git ~/my-claude-skills
```

```bash
cd ~/.claude && for d in skills commands output-styles; do [ -e "$d" ] && mv "$d" "$d.bak-$(date +%s)"; ln -s ~/my-claude-skills/"$d" "$d"; done
```

Restart Claude Code. Run `/skills` to confirm they loaded.

## Keep both machines in sync

Pull the latest:

```bash
git -C ~/my-claude-skills pull
```

Push a change you made:

```bash
git -C ~/my-claude-skills add -A && git -C ~/my-claude-skills commit -m "update skills" && git -C ~/my-claude-skills push
```

Because `~/.claude/skills` is a link into this repo, editing a skill edits the repo. No copying needed.

## Using these in Claude Code on the web / cloud

A cloud session does not read `~/.claude`. It reads your project repo. So for the cloud, copy the skills you need into the project instead:

```bash
mkdir -p .claude/skills && cp -R ~/my-claude-skills/skills/<skill-name> .claude/skills/
```

Then commit them with the project.

## Not included

Plugin skills (small-business, marketing, design, pdf-viewer, and so on) are not files in here. Re-add those with `/plugin` on each machine.
