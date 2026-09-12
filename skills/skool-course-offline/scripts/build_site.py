#!/usr/bin/env python3
"""Build an offline copy of a Skool course from a harvested JSON file.

Input : the JSON produced by harvest.js (a flat list of course nodes).
Output: <library>/<Course Name>/ containing README.md, site/ (browsable HTML
        with local images), markdown/, <course>-FULL.md and raw/.

Usage:
    python3 build_site.py --raw path/to/course.json --out "~/Desktop/Courses"
    python3 build_site.py --raw c.json --out . --no-images   # text only, fast
"""
import argparse, concurrent.futures as cf, hashlib, html, json, os, re, shutil
import urllib.parse, urllib.request

# ---------------------------------------------------------------- helpers
def slug(s, n=70):
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE).strip()
    s = re.sub(r"[\s_]+", "-", s)
    return (s[:n] or "untitled").lower()

class Images:
    """Download images once, map remote URL -> local relative path."""
    def __init__(self, dirpath, enabled=True):
        self.dir, self.enabled, self.map = dirpath, enabled, {}
    def plan(self, url):
        if not url: return None
        if not self.enabled: return url
        if url not in self.map:
            ext = os.path.splitext(url.split("?")[0])[1] or ".png"
            self.map[url] = "images/" + hashlib.sha1(url.encode()).hexdigest()[:16] + ext
        return self.map[url]
    def fetch_all(self, workers=8):
        if not self.enabled or not self.map: return 0, 0
        os.makedirs(self.dir, exist_ok=True)
        todo = [(u, p) for u, p in self.map.items()
                if not os.path.exists(os.path.join(self.dir, os.path.basename(p)))]
        ok = fail = 0
        def get(item):
            u, p = item
            try:
                req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=90) as r:
                    data = r.read()
                with open(os.path.join(self.dir, os.path.basename(p)), "wb") as f:
                    f.write(data)
                return True, u
            except Exception as e:
                return False, f"{u} :: {e}"
        with cf.ThreadPoolExecutor(workers) as ex:
            for good, info in ex.map(get, todo):
                if good: ok += 1
                else:
                    fail += 1
                    print("  ! image failed:", info)
        return ok, fail

class Files:
    """Save lesson attachments. Signed URLs expire ~8h after harvest."""
    def __init__(self, dirpath, enabled=True):
        self.dir, self.enabled, self.items = dirpath, enabled, []
    def plan(self, res_json, lesson_slug):
        """res_json is metadata.resources (a JSON string). Returns a render list."""
        if not res_json or res_json == "[]": return []
        try: items = json.loads(res_json)
        except Exception: return []
        out = []
        for it in items:
            title = it.get("title") or it.get("file_name") or "Attachment"
            if it.get("link"):
                out.append({"title": title, "href": it["link"], "external": True})
                continue
            name = it.get("file_name") or (it.get("file_id", "file") + ".bin")
            safe = re.sub(r'[/\\:*?"<>|]', "-", name)
            rel = f"files/{lesson_slug}/{safe}"
            if it.get("dl") and self.enabled:
                self.items.append((it["dl"], rel))
                out.append({"title": title, "href": urllib.parse.quote(rel),
                            "external": False})
            else:
                out.append({"title": title, "href": it.get("dl"), "external": True,
                            "missing": not it.get("dl")})
        return out
    def fetch_all(self, workers=6):
        if not self.enabled or not self.items: return 0, 0
        ok = fail = 0
        def get(job):
            url, rel = job
            dest = os.path.join(self.dir, rel)
            if os.path.exists(dest): return True, rel
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=120) as r:
                    data = r.read()
                open(dest, "wb").write(data)
                return True, rel
            except Exception as e:
                return False, f"{rel} :: {e}"
        with cf.ThreadPoolExecutor(workers) as ex:
            for good, info in ex.map(get, self.items):
                if good: ok += 1
                else:
                    fail += 1
                    print("  ! attachment failed:", info)
        return ok, fail


def resources_html(res):
    if not res: return ""
    rows = []
    for r in res:
        if r.get("missing"):
            rows.append(f'<li>{html.escape(r["title"])} <em>(link expired — re-run the harvest)</em></li>')
        elif r["external"]:
            rows.append(f'<li><a href="{html.escape(r["href"])}" target="_blank" rel="noopener">'
                        f'{html.escape(r["title"])}</a> <span class="ext">link</span></li>')
        else:
            rows.append(f'<li><a href="{html.escape(r["href"])}" download>'
                        f'{html.escape(r["title"])}</a></li>')
    return '<div class="res"><h3>Downloads</h3><ul>' + "".join(rows) + "</ul></div>\n"


def resources_md(res):
    if not res: return ""
    out = ["\n### Downloads\n"]
    for r in res:
        if r.get("missing"): out.append(f"- {r['title']} (link expired)")
        else: out.append(f"- [{r['title']}]({r['href']})")
    return "\n".join(out) + "\n"


# ---------------------------------------------------------- [v2] renderer
# metadata.desc == "[v2]" + JSON array of ProseMirror-style nodes.
def _text(node, fmt):
    t = html.escape(node.get("text", "")) if fmt == "html" else node.get("text", "")
    for m in node.get("marks", []):
        k, a = m.get("type"), (m.get("attrs") or {})
        if k == "bold":     t = f"<strong>{t}</strong>" if fmt == "html" else f"**{t}**"
        elif k == "italic": t = f"<em>{t}</em>"        if fmt == "html" else f"*{t}*"
        elif k == "code":   t = f"<code>{t}</code>"    if fmt == "html" else f"`{t}`"
        elif k == "link":
            href = a.get("href", "#")
            t = (f'<a href="{html.escape(href)}" target="_blank" rel="noopener">{t}</a>'
                 if fmt == "html" else f"[{t}]({href})")
    return t

def _inline(nodes, fmt, imgs):
    out = []
    for n in nodes or []:
        ty = n.get("type")
        if ty == "text": out.append(_text(n, fmt))
        elif ty == "hardBreak": out.append("<br>" if fmt == "html" else "  \n")
        elif ty == "image": out.append(_block(n, fmt, imgs))
        else: out.append(_inline(n.get("content"), fmt, imgs))
    return "".join(out)

def _block(n, fmt, imgs, depth=0):
    ty, a, c = n.get("type"), n.get("attrs") or {}, n.get("content") or []
    if ty == "paragraph":
        b = _inline(c, fmt, imgs)
        if not b.strip(): return ""
        return f"<p>{b}</p>\n" if fmt == "html" else b + "\n\n"
    if ty == "heading":
        lv = min(int(a.get("level", 2)) + 1, 6)
        b = _inline(c, fmt, imgs)
        return f"<h{lv}>{b}</h{lv}>\n" if fmt == "html" else "#" * lv + " " + b + "\n\n"
    if ty == "blockquote":
        inner = "".join(_block(x, fmt, imgs, depth) for x in c)
        if fmt == "html": return f"<blockquote>{inner}</blockquote>\n"
        return "".join("> " + l + "\n" for l in inner.strip().split("\n")) + "\n"
    if ty == "codeBlock":
        txt = "".join(x.get("text", "") for x in c)
        if fmt == "html":
            return f"<pre><code>{html.escape(txt)}</code></pre>\n"
        lang = a.get("language") or ""
        return f"```{lang}\n{txt}\n```\n\n"
    if ty in ("unorderedList", "bulletList", "orderedList"):
        items = []
        for i, li in enumerate(c, int(a.get("start", 1) or 1)):
            inner = "".join(_block(x, fmt, imgs, depth + 1) for x in (li.get("content") or []))
            if fmt == "html":
                items.append(f"<li>{inner}</li>")
            else:
                lines = inner.strip().split("\n")
                bullet = "- " if ty != "orderedList" else f"{i}. "
                items.append(bullet + lines[0] + "".join("\n  " + l for l in lines[1:]))
        if fmt == "html":
            tag = "ol" if ty == "orderedList" else "ul"
            st = f' start="{a["start"]}"' if ty == "orderedList" and a.get("start") else ""
            return f"<{tag}{st}>{''.join(items)}</{tag}>\n"
        return "\n".join(items) + "\n\n"
    if ty == "image":
        # originalSrc is full-size; src is a smaller "-md" variant.
        src = imgs.plan(a.get("originalSrc") or a.get("src"))
        alt = a.get("alt") or ""
        return (f'<figure><img src="{src}" alt="{html.escape(alt)}" loading="lazy"></figure>\n'
                if fmt == "html" else f"![{alt}]({src})\n\n")
    if ty == "text": return _text(n, fmt)
    if ty == "hardBreak": return "<br>" if fmt == "html" else "  \n"
    return "".join(_block(x, fmt, imgs, depth) for x in c)   # unknown -> recurse

def render(desc, fmt, imgs):
    if not desc: return ""
    doc = json.loads(desc[4:] if desc.startswith("[v2]") else desc)
    if isinstance(doc, dict): doc = doc.get("content") or []
    return "".join(_block(n, fmt, imgs) for n in doc)

# ------------------------------------------------------------------- CSS
CSS = """
:root{--bg:#faf9f7;--fg:#22201d;--mut:#6b6560;--line:#e3ded7;--acc:#c2410c;--card:#fff}
@media(prefers-color-scheme:dark){:root{--bg:#171614;--fg:#eae7e2;--mut:#a09a93;--line:#332f2b;--acc:#fb923c;--card:#1f1e1b}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;display:flex}
nav{width:300px;flex:0 0 300px;height:100vh;overflow-y:auto;border-right:1px solid var(--line);padding:20px 16px;position:sticky;top:0;background:var(--card)}
nav h1{font-size:15px;margin:0 0 14px;letter-spacing:.02em}
nav .sec{font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--mut);margin:18px 0 6px;font-weight:700}
nav a{display:block;padding:5px 8px;border-radius:6px;color:var(--fg);text-decoration:none;font-size:13.5px}
nav a:hover{background:var(--bg)}
nav a.cur{background:var(--acc);color:#fff}
main{flex:1;min-width:0;max-width:820px;margin:0 auto;padding:40px 32px 100px}
.kicker{font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:var(--acc);font-weight:700}
h1.t{font-size:32px;line-height:1.2;margin:8px 0 24px}
h2,h3,h4{line-height:1.3;margin:1.8em 0 .5em}
img{max-width:100%;height:auto;border-radius:10px;display:block}
figure{margin:22px 0}
blockquote{margin:18px 0;padding:2px 18px;border-left:3px solid var(--acc);color:var(--mut)}
code{background:var(--card);border:1px solid var(--line);padding:1px 5px;border-radius:4px;font-size:.9em}
a{color:var(--acc)}
.vid{display:inline-block;margin:0 0 24px;padding:10px 16px;border:1px solid var(--line);border-radius:8px;background:var(--card);text-decoration:none;font-weight:600}
.res{margin:34px 0 0;padding:16px 18px;border:1px solid var(--line);border-radius:10px;background:var(--card)}
.res h3{margin:0 0 8px;font-size:14px;letter-spacing:.05em;text-transform:uppercase;color:var(--mut)}
.res ul{margin:0;padding-left:20px}
.res li{margin:4px 0}
.res .ext{color:var(--mut);font-size:12px}
.pager{display:flex;justify-content:space-between;gap:12px;margin-top:60px;border-top:1px solid var(--line);padding-top:20px}
.pager a{text-decoration:none;font-weight:600}
@media(max-width:900px){body{display:block}nav{width:auto;height:auto;position:static;border-right:0;border-bottom:1px solid var(--line)}main{padding:24px 18px 60px}}
"""

# ------------------------------------------------------------------ build
def write_readme(out, course, lessons, n_images, n_video, n_locked, rawname, fullname,
                 n_files=0):
    """Plain-language quick start dropped into each course folder."""
    locked = (f"\n- {n_locked} lesson(s) were locked, so they are empty here.\n"
              if n_locked else "")
    video = ("\n## One limit\n\n"
             f"{n_video} lessons have a video. Videos are **not** saved — they live on\n"
             "someone else's server (Loom, Wistia, YouTube). Each lesson page has a\n"
             "\"Watch the video\" button, and that button needs internet.\n\n"
             "All the written lessons and all the images work offline.\n"
             if n_video else "")
    filesrow = (f"| `site/files/` | {n_files} attached files, ready to open. |\n"
                if n_files else "")
    sections, last = [], None
    for L in lessons:
        if L["section"] and L["section"] != last:
            last = L["section"]; sections.append(last)
    outline = "".join(f"- {s}\n" for s in sections)

    txt = f"""# {course}

Offline copy. No internet needed.

## Quick start

**Double-click this file:**

    site/index.html

It opens in your browser. A list of every lesson is on the left. Click any
lesson to read it. Use the arrows at the bottom of a page to go forward or
back.

That is all you need. The rest of this file is extra.

## What is in this folder

| Folder / file | What it is |
| --- | --- |
| `site/index.html` | **Start here.** The course, as a website on your Mac. |
| `site/images/` | Every picture, saved locally ({n_images} of them). |
{filesrow}| `markdown/` | The same lessons as plain text files, one per lesson. |
| `{fullname}` | The whole course in one long text file. |
| `raw/{rawname}` | The source data, so this can be rebuilt. |

Use `markdown/` if you want to paste lessons into notes, Claude, or a doc.
Use `site/` if you just want to read.

## What is inside

{len(lessons)} lessons across these parts:

{outline}{locked}{video}
## Moving it

Move or copy the whole folder anywhere you like. Everything inside points at
itself, so nothing breaks. It also works from a USB stick.

## Rebuilding

    python3 ~/.claude/skills/skool-course-offline/scripts/build_site.py \\
      --raw "raw/{rawname}" --out ..
"""
    open(os.path.join(out, "README.md"), "w").write(txt)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True, help="harvested JSON file")
    ap.add_argument("--out", required=True,
                help="library folder; a subfolder per course is created inside it")
    ap.add_argument("--folder", help="override the course folder name")
    ap.add_argument("--no-images", action="store_true", help="skip image download")
    ap.add_argument("--no-files", action="store_true", help="skip attachment download")
    args = ap.parse_args()

    library = os.path.abspath(os.path.expanduser(args.out))
    nodes = json.load(open(args.raw))
    course = nodes[0]["title"]

    # Each course gets its own folder inside the library folder.
    folder = args.folder or re.sub(r'[/\\:*?"<>|]', "-", course).strip() or "course"
    out = os.path.join(library, folder)
    site, mdd = os.path.join(out, "site"), os.path.join(out, "markdown")
    for d in (site, mdd): os.makedirs(d, exist_ok=True)
    imgs = Images(os.path.join(site, "images"), enabled=not args.no_images)
    files = Files(site, enabled=not args.no_files)

    # Sections are tracked by depth: a lesson belongs to the nearest heading
    # one level above it. A lesson sitting at the top level has no section.
    lessons, headings = [], {}
    for n in nodes[1:]:
        d = n.get("depth", 1)
        if n.get("kids", 0) > 0:
            headings[d] = n["title"]
            for k in [k for k in headings if k > d]: del headings[k]
            continue
        m = n.get("meta") or {}
        if not m: continue
        lessons.append({"section": headings.get(d - 1, ""), "title": n["title"],
                        "desc": m.get("desc"), "video": m.get("videoLink"),
                        "resources": m.get("resources"), "id": n.get("id")})
    if not lessons:
        raise SystemExit("No lessons found. Did harvest.js finish?")

    for i, L in enumerate(lessons):
        base = f"{i:02d}-{slug(L['title'])}"
        L["file"], L["mdfile"] = base + ".html", base + ".md"
        L["res"] = files.plan(L.get("resources"), base)

    open(os.path.join(site, "style.css"), "w").write(CSS)

    def sidebar(cur):
        parts, last = [f"<h1>{html.escape(course)}</h1>"], None
        for L in lessons:
            if L["section"] != last:
                last = L["section"]
                if last:  # a lesson sitting outside any section has none
                    parts.append(f'<div class="sec">{html.escape(last)}</div>')
            k = ' class="cur"' if L["file"] == cur else ""
            parts.append(f'<a href="{L["file"]}"{k}>{html.escape(L["title"])}</a>')
        return "<nav>" + "".join(parts) + "</nav>"

    print(f"Rendering {len(lessons)} lessons ...")
    for i, L in enumerate(lessons):
        body = render(L["desc"], "html", imgs)
        vid = (f'<a class="vid" href="{L["video"]}" target="_blank" rel="noopener">'
               f'&#9654; Watch the video (needs internet)</a><br>') if L["video"] else ""
        prev = (f'<a href="{lessons[i-1]["file"]}">&larr; {html.escape(lessons[i-1]["title"])}</a>'
                if i else "<span></span>")
        nxt = (f'<a href="{lessons[i+1]["file"]}">{html.escape(lessons[i+1]["title"])} &rarr;</a>'
               if i < len(lessons) - 1 else "<span></span>")
        open(os.path.join(site, L["file"]), "w").write(
f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(L['title'])} &middot; {html.escape(course)}</title>
<link rel="stylesheet" href="style.css"></head><body>
{sidebar(L['file'])}
<main>{f'<div class="kicker">{html.escape(L["section"])}</div>' if L['section'] else ''}
<h1 class="t">{html.escape(L['title'])}</h1>
{vid}
{body}
{resources_html(L['res'])}
<div class="pager">{prev}{nxt}</div>
</main></body></html>""")

        md = [f"# {L['title']}", ""]
        if L["section"]: md += [f"*{L['section']}*", ""]
        if L["video"]: md += [f"Video: {L['video']}", ""]
        md.append(render(L["desc"], "md", imgs))
        md.append(resources_md(L["res"]))
        open(os.path.join(mdd, L["mdfile"]), "w").write("\n".join(md))

    rows, last = [], None
    for L in lessons:
        if L["section"] != last:
            last = L["section"]
            if last: rows.append(f'<div class="sec">{html.escape(last)}</div>')
        rows.append(f'<a href="{L["file"]}">{html.escape(L["title"])}</a>')
    open(os.path.join(site, "index.html"), "w").write(
f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(course)}</title><link rel="stylesheet" href="style.css"></head><body>
{sidebar('')}
<main><div class="kicker">Offline copy</div><h1 class="t">{html.escape(course)}</h1>
<p>{len(lessons)} lessons. Click any lesson to start.</p>{''.join(rows)}</main></body></html>""")

    with open(os.path.join(mdd, "00-INDEX.md"), "w") as f:
        f.write(f"# {course}\n\n"); last = None
        for L in lessons:
            if L["section"] != last:
                last = L["section"]
                if last: f.write(f"\n## {last}\n\n")
            f.write(f"- [{L['title']}]({L['mdfile']})\n")

    full = os.path.join(out, f"{slug(course)}-FULL.md")
    with open(full, "w") as f:
        f.write(f"# {course}\n"); last = None
        for L in lessons:
            if L["section"] != last:
                last = L["section"]
                if last: f.write(f"\n\n---\n\n# {last}\n")
            f.write(f"\n\n## {L['title']}\n\n")
            if L["video"]: f.write(f"Video: {L['video']}\n\n")
            f.write(render(L["desc"], "md", imgs))
            f.write(resources_md(L["res"]))

    print(f"Downloading {len(imgs.map)} images ...")
    ok, fail = imgs.fetch_all()
    print(f"Downloading {len(files.items)} attachments ...")
    fok, ffail = files.fetch_all()

    # keep the source data next to the course so it can be rebuilt later
    rawdir = os.path.join(out, "raw")
    os.makedirs(rawdir, exist_ok=True)
    rawcopy = os.path.join(rawdir, os.path.basename(args.raw))
    if os.path.abspath(args.raw) != os.path.abspath(rawcopy):
        shutil.copy2(args.raw, rawcopy)

    n_video = sum(1 for L in lessons if L["video"])
    n_locked = sum(1 for n in nodes[1:]
                   if n.get("kids", 0) == 0 and not (n.get("meta") or {}).get("desc"))
    write_readme(out, course, lessons, ok, n_video, n_locked,
                 os.path.basename(rawcopy), os.path.basename(full), fok)

    print(f"\nDone. {len(lessons)} lessons, {ok} images, {fok} attachments. "
          f"{fail + ffail} failed.")
    print("Folder:", out)
    print("Open  :", os.path.join(site, "index.html"))

if __name__ == "__main__":
    main()
