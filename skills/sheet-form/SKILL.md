---
name: sheet-form
description: Wire a website form to a Google Sheet with confirmation and notification emails, using one Google Apps Script Web App as the backend. No server, no third-party form service, works on any static host (Cloudflare Pages, Netlify, Vercel, GitHub Pages). Use when the user wants a contact form, support form, waiting list, signup, enquiry form, beta list, newsletter capture, booking request, or "a form that goes to a spreadsheet" / "emails me when someone fills it in". Also use to add a second form to an Apps Script backend that already exists, to add Cloudflare Turnstile spam protection to one, or to change the wording of the emails it sends.
user-invocable: true
---

# sheet-form: static site → Google Sheet → email

One Apps Script Web App is the whole backend. The site POSTs JSON to it. It
appends a row to a tab in a Sheet, emails the person who filled it in, and
emails the owner. Free, no server, no vendor.

**One script per site, not per form.** The body carries a `kind` field and the
script routes on it. A second form is a new entry in `FORMS`, not a second
deployment. Deploying twice means two URLs, two authorisations, and two places
to fix a typo.

## Before you write anything, ask

1. **Which Sheet?** An existing one, or should the user make one first? The
   script must be **bound** to it (Extensions > Apps Script from inside the
   Sheet), because it calls `SpreadsheetApp.getActiveSpreadsheet()`.
2. **What fields?** Name them exactly. Every field becomes a column.
3. **What should the two emails say?** Draft them in the user's voice, show
   them, and get the wording agreed *before* deploying. Changing an email later
   costs a redeploy (see Gotcha 1).
4. **Spam protection?** Honeypot is always on. Ask whether they also want
   Turnstile (see below). On Cloudflare, say yes.

Do not start clicking through Google until you have these answers.

## Files you create

| Where | What |
|---|---|
| `apps-script/Code.gs` | from `templates/Code.gs`, adapted |
| `apps-script/README.md` | from `templates/SETUP.md`, adapted |
| `src/lib/forms.ts` | from `templates/forms.ts` — the shared poster |
| `src/lib/<formname>.ts` | field list + one `submit` function per form |
| `.env` / `.env.example` | `VITE_FORMS_ENDPOINT=` |

Keep `Code.gs` in the repo even though it runs in Google. It is the source of
truth. The copy in Google is a deployment artifact.

## The client contract — do not break these two rules

**1. Post plain text with no custom headers.**

```ts
fetch(endpoint, { method: 'POST', redirect: 'follow', body: JSON.stringify(body) })
```

Adding `Content-Type: application/json` makes it a non-simple request. The
browser sends a preflight `OPTIONS` first, and Apps Script cannot answer
`OPTIONS`. You get a CORS error that looks like a network fault. The script
reads `e.postData.contents` and parses it itself, so the header buys nothing.

**2. Never fake success.** If the endpoint env var is unset, the form must show
the user a `mailto:` fallback, not a thank-you. A thank-you for a message that
went nowhere is worse than no form.

## Spam protection

Three layers, cheapest first. Do all three when the host is Cloudflare.

1. **Honeypot** — a field hidden from people (`position:absolute;left:-9999px`,
   `tabindex="-1"`, `autocomplete="off"`). Anything that fills it is a bot.
   Return `{ok:true}` and drop the row. Never return an error: a rejection tells
   the bot what to change.
2. **Minimum fill time** — the client stamps `startedAt` when the form mounts
   and sends the elapsed seconds. Under 3 seconds is a bot. Free, 5 lines.
3. **Cloudflare Turnstile** — free, invisible for most visitors. The client
   sends the token as an ordinary body field; the script verifies it with
   `UrlFetchApp` against `challenges.cloudflare.com/turnstile/v0/siteverify`.
   Adds no headers, so rule 1 above still holds.

The user must create the Turnstile widget themselves and hand you both keys.
The **site key** is public and goes in the page. The **secret key** goes in
Apps Script under **Project Settings > Script Properties**, never in the repo
and never in `Code.gs`.

## Doing the Google steps in the browser

You can drive most of this with the Chrome extension. Read
`templates/SETUP.md` for the click path. What matters:

### Gotcha 1: saving the code does not change the live URL
A Web App deployment is pinned to a **version**. Editing `Code.gs` and pressing
Save changes nothing for visitors. You must go **Deploy > Manage deployments >
pencil > Version: New version > Deploy**. Same URL, same deployment ID, new
code. If a user says "I changed the wording" — they almost certainly did not
redeploy. Check, and check whether their edit saved at all.

### Gotcha 2: the "signed in as" popup swallows Cmd+S
The Apps Script editor sometimes shows a "You're currently signed in as …"
dialog. It eats the first save. If the header still says **Unsaved changes**
after Cmd+S, screenshot, dismiss the dialog with **OK**, click into the editor
and save again. Confirm the header reads **Saved to Drive** before deploying.

### Gotcha 3: typing 250 lines into the editor is slow and wrong
Monaco auto-indents and auto-closes brackets, so typed code arrives mangled.
Inject it instead. Base64 the file to survive quoting, then in the page:

```js
const src = new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
const ed = monaco.editor.getEditors()[0];
const m = ed.getModel();
ed.executeEdits('load', [{ range: m.getFullModelRange(), text: src }]);
ed.pushUndoStop();
```

Use `executeEdits` rather than `model.setValue` so the IDE registers the change
and enables Save. For a one-line change, replace just that line and diff the
before/after in the return value so you can prove it landed.

### Gotcha 4: the OAuth screen is not yours to click
"Authorize access" opens a Google consent window **outside** the extension's tab
group. You cannot reach it, and you should not: it is the user's account. Stop
and tell them exactly what to click:

> Pick your account → "Google hasn't verified this app" → **Advanced** → **Go to
> \<project name\> (unsafe)** → **Allow**.

Say plainly why the scary warning is normal (it is their own script) and what
the two permissions are for (write the row, send the emails).

### Gotcha 5: the Sheets home list has no links
Rows in `docs.google.com/spreadsheets/u/0/` carry no `href` and no doc id in the
DOM. `find` + click-by-ref does not open them. Screenshot and **double-click the
title by coordinates**. Then read the real URL from the tab context.

## Testing, in this order

Test the paths that send no email first. Only send a live one with permission —
it puts real mail in the user's inbox.

```bash
URL=$(grep VITE_FORMS_ENDPOINT .env | cut -d= -f2-)
post(){ curl -sL --data-raw "$1" "$URL" | head -c 300; echo; }

curl -sL "$URL"                                                    # {"ok":true,"service":...}
post '{"kind":"contact","website":"bot","email":"a@b.co","message":"x"}'   # {"ok":true}, no row
post '{"kind":"contact","email":"nope","message":"x"}'                     # bad-email
post '{"kind":"contact","email":"a@b.co","message":"  "}'                  # empty-message
```

**Do not use `curl -X POST`.** Apps Script answers a POST with a 302 to
`script.googleusercontent.com`, which must be fetched with GET. `-X POST` forces
POST on the redirect too and you get a Drive "unable to open the file" HTML page
that looks like a broken deployment. `--data-raw` alone implies POST correctly.

Then confirm in the Sheet that the tab was created with frozen headings, and ask
the user to check both emails landed — including that **reply** on the owner
notification goes to the sender, not to themselves.

## Shipping

The endpoint lives in `.env`, which is not committed. **The host needs it too.**
On Cloudflare Pages: Settings > Environment variables > add `VITE_FORMS_ENDPOINT`
for Production *and* Preview.

**Then rebuild.** Vite bakes `VITE_*` values into the bundle at *build* time, not
at page load. Adding the variable after a deploy changes nothing until the next
build — on Cloudflare, Deployments > latest > **Retry deployment**. Say this
before they deploy, not after: the symptom is a site that works perfectly on
localhost and shows the mailto fallback in production, which reads like the code
never shipped. It did. The bundle was built blind.

Diagnose it in one step: if the page shows the fallback, the variable did not
reach the *build*. Check the exact spelling and that it is set for Production,
not Preview only.

Also update the site's privacy page. A form that collects a name and free text
collects more than an email address, and the old wording will be wrong.

## Templates

- `templates/Code.gs` — the backend. Edit `CONFIG` and `FORMS` at the top.
- `templates/forms.ts` — the shared client poster.
- `templates/SETUP.md` — the human's click path, to adapt into the repo.
