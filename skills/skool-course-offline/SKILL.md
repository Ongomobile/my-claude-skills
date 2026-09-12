---
name: skool-course-offline
description: Save a Skool.com classroom course for offline reading — every lesson as a browsable local HTML site plus Markdown, with all images downloaded. Use when the user gives a skool.com classroom URL and wants it offline, archived, backed up, downloaded, saved locally, or converted to Markdown/PDF-ready text. Also use for "rip this course", "make this course offline", "scrape my Skool classroom", or when they want the same treatment applied to another course in a Skool group.
---

# Skool course → offline copy

Turns a Skool classroom course into a self-contained folder: a browsable HTML
site with a sidebar, per-lesson Markdown, one combined Markdown file, a plain
quick-start README, and every image saved locally. Videos stay as external
links (see Limits).

**One folder per course.** `--out` is a *library* folder, and the script creates
a subfolder inside it named after the course. Point several courses at the same
library and they sit side by side, each self-contained and movable.

Do not scrape the rendered page. Skool is a Next.js app and hands you the whole
course as JSON. Read the JSON.

## Requirements

- The **Claude in Chrome extension** (`mcp__claude-in-chrome__*`), because the
  user's Skool login lives there. The in-app browser is not logged in.
- The user must already have access to the course. This skill only saves what
  they can already read.

## Steps

### 1. Confirm scope and destination

Ask only if unclear: which course, and which library folder to put it in.
If the user already has a library folder from a previous run, reuse it — do not
start a second one. Otherwise default to `~/Desktop/Skool Courses`.

### 2. Open the classroom and get the ids

Pasted URLs are often broken — the `md=` id must be exactly 32 hex characters
and a truncated one gives a Skool 404 page. Do not debug the pasted URL. Open
the bare classroom instead and let Skool redirect:

```
https://www.skool.com/<group>/classroom
```

Then read the page data:

```js
const j = JSON.parse(document.getElementById('__NEXT_DATA__').textContent);
[j.buildId, document.title]
```

Navigate to the course, then collect:

- `GROUP`  — the slug in the URL
- `COURSE` — the course name in the URL (e.g. `eeed3be1`); it is the `name`
  field of the course node in `__NEXT_DATA__`, not the title
- `BUILD`  — `j.buildId`

If you must print ids, break them up first (`id.replace(/(.{8})/g,'$1-')`) —
`javascript_tool` masks long hex strings as `[BLOCKED: Base64 encoded data]`.

### 3. Harvest every lesson

The course tree holds every title, but `metadata.desc` (the lesson body) is
filled in only for the module named in `md=`. So fetch once per lesson via:

```
/_next/data/<BUILD>/<GROUP>/classroom/<COURSE>.json?md=<moduleId>&group=<GROUP>&id=<COURSE>
```

Use `scripts/harvest.js`. Replace `GROUP_SLUG`, `COURSE_NAME`, `BUILD_ID`, then
run it with `mcp__claude-in-chrome__javascript_tool`. It returns `"started"`
immediately; poll `window.__skoolHarvest` (a long synchronous loop would time
out). A 53-lesson course takes about 60–90 seconds.

It also resolves a signed download URL for every attachment, so a course with
files takes a little longer. Watch `H.files` for the count.

**Ask the user before the first run in a session.** The last thing it does is
save a JSON file to `~/Downloads`, and saving files needs their OK. Say what the
file is and roughly how big (about 8 KB per lesson).

Then move it: `mv ~/Downloads/<COURSE>-course.json <out>/raw/`

### 4. Build the offline copy

```bash
python3 ~/.claude/skills/skool-course-offline/scripts/build_site.py \
  --raw "<downloaded json>" --out "<library folder>"
```

Images are large (often ~4 MB each). Run this in the background — a foreground
Bash call times out at 2 minutes. Add `--no-images` for a fast text-only pass.
Use `--folder "Name"` only if the course title makes a bad folder name.

Produces `<library>/<Course Name>/`:

```
README.md                 <- plain quick start, written for you
site/index.html           <- the thing to open
site/images/              <- every image, local
site/files/               <- every attachment, one folder per lesson
markdown/                 <- one .md per lesson + 00-INDEX.md
<course>-FULL.md          <- whole course, one file
raw/<name>.json           <- source data, copied in so it can be rebuilt
```

The README, image count, section outline, and video/locked-lesson warnings are
generated from the real data — do not hand-write one. Re-running is safe:
already-downloaded images are skipped.

### 5. Verify, then hand over

Check before you report success:

```bash
python3 - <<'PY'
import re, os, glob, html as H, urllib.parse
os.chdir("<library>/<Course Name>/site"); bad = 0
for f in glob.glob("*.html"):
    s = open(f).read()
    for src in re.findall(r'<img src="([^"]+)"', s):
        if src.startswith("http") or not os.path.exists(H.unescape(src)):
            print("BAD", f, src[:70]); bad += 1
    for h in re.findall(r'<a href="(files/[^"]+)" download>', s):
        if not os.path.exists(urllib.parse.unquote(H.unescape(h))):
            print("MISSING FILE", f, h[:70]); bad += 1
    if '"type":' in s or '[v2]' in s: print("RAW JSON LEAK", f); bad += 1
print("problems:", bad)
PY
```

Run the check against `<library>/<Course Name>/site`.

Then `open` that folder's `site/index.html` and close any Chrome tab you
created (`tabs_close_mcp`). The README is already written — just tell the user
to double-click `site/index.html`.

## Limits — state these plainly

- **Videos are not saved.** They are external (Loom, Wistia, YouTube). Each
  lesson page gets a "Watch the video" button that needs internet.
- Locked lessons return `hasAccess: 0` and no body. They appear in the sidebar
  but are empty. Say how many were skipped.
- Attachments **are** saved. `metadata.resources` is a JSON string; entries with
  a `file_id` need a signed URL from
  `POST https://api2.skool.com/files/<file_id>/download-url?expire=28800`
  (GET returns 405). `harvest.js` resolves these and stores them as `dl`.
  **Those URLs expire in 8 hours** — build soon after harvesting, or re-harvest.
  Entries with a `link` instead are external and stay as links.

## Things that do not work — do not retry them

- **Sending the data to a local HTTP server.** The page cannot `fetch()`
  `http://127.0.0.1`; it fails as `TypeError: Failed to fetch` and never reaches
  the server. CORS headers, `Access-Control-Allow-Private-Network`, and
  `targetAddressSpace: 'private'|'local'` all fail. Use the download.
- **`curl` with the user's cookies.** Skool's auth cookie is httpOnly, so
  `document.cookie` cannot expose it. Every Skool fetch must run in the browser.
- **Scraping `<a>` tags on `/classroom`.** Course cards are not links.
- `pageProps.selectedModule` is a bare id string, not an object.
- **Image URLs are public** — `assets.skool.com` needs no login, so those are
  fine to fetch from the shell. Use `attrs.originalSrc` (full size), not
  `attrs.src` (a smaller `-md` variant).

## The `[v2]` body format

`metadata.desc` is the literal string `[v2]` followed by a JSON array of
ProseMirror-style nodes. `build_site.py` renders it.

- Blocks: `paragraph`, `heading` (`attrs.level`, offset by +1 so the page title
  stays `h1`), `image`, `unorderedList` (alias `bulletList`), `orderedList`
  (`attrs.start`), `listItem`, `blockquote`, `codeBlock`, `hardBreak`
- Marks: `bold`, `italic`, `code`, `link` (`attrs.href`), `videoTimestamp`
- Unknown node types recurse into `content` rather than being dropped.
