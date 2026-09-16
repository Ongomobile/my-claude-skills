# Click paths

Exact steps for each dashboard. "Claude" steps run in Claude's own Chrome tab
group. "Owner" steps are handed to the person with the wording given, then
Claude waits for them to say done. Dashboards change; if a screen does not
match, screenshot and adapt rather than guessing.

## Contents
1. Cloudflare R2 (downloads)
2. Resend (owner)
3. Cloudflare Turnstile
4. Google Apps Script
5. Cloudflare DNS hardening
6. Owner's live test

---

## 1. Cloudflare R2 (downloads)

**Owner, first time only:** "In Cloudflare, open R2 Object Storage and turn it
on. It asks for a payment method even on the free tier; that part is yours."

**Claude:**
1. `https://dash.cloudflare.com/?to=/:account/r2/overview`. If an account
   picker appears, choose the account that holds the site's domain.
2. **Create bucket** > name `<brand>-downloads` > leave location Automatic and
   class Standard > **Create bucket**.
3. Build a zip of all files if the offer has a bundle:
   `zip -j <scratchpad>/<name>.zip file1.pdf file2.pdf`. Copy files to the
   scratchpad under lowercase, hyphenated, human-readable names first.
4. In the bucket, `find` the file input labelled "Files" and `file_upload` the
   files (10 MB per call). Refresh and confirm names, types and sizes.
5. **Settings** > **Custom Domains** > **Add** > `files.<domain>` > Continue.
   The preview shows a CNAME in the zone; if it cannot find the zone, the
   domain is in another Cloudflare account. **Connect domain**.
6. Verify, allowing a minute for "Initializing":
   ```bash
   for f in a.pdf b.pdf; do curl -sI "https://files.<domain>/$f" | head -1; done
   curl -s https://files.<domain>/a.pdf | shasum -a 256; shasum -a 256 a.pdf
   ```
   A 403 in the first minute is normal. Checksums must match.

## 2. Resend (owner)

Hand over this, adapted:

1. Sign in at resend.com. Prefer an account the client owns; a shared account
   works but shares its sending limit.
2. **Domains** > **Add domain** > enter `mail.<domain>` (Resend refuses the bare
   domain) > leave Advanced options > **Add domain**.
3. Choose **Auto configure** with Cloudflare and sign in to the Cloudflare
   account that holds the domain.
4. Wait for **Verified**. Pending for a few minutes is normal.
5. **API Keys** > **Create API key**: name it after the project, permission
   **Sending access**, domain `mail.<domain>`. Keep it out of chat; it goes
   into Apps Script later.

**Claude, while they wait:** confirm the records exist so "Pending" is just
Resend being slow:
```bash
d(){ printf '%s %s -> ' "$2" "$1"; dig +short "$2" "$1" @1.1.1.1 | tr '\n' ' '; echo; }
d TXT resend._domainkey.mail.<domain>; d MX send.mail.<domain>; d TXT send.mail.<domain>
```
(zsh does not word-split `set -- $q`; use the function form.)

## 3. Cloudflare Turnstile

**Claude:**
1. `https://dash.cloudflare.com/<account id>/turnstile` > **Add widget
   manually** (not "Set up with Spin").
2. Widget name: `<Brand> signup form`. Hostnames: type the domain, pick it
   from the dropdown. Mode: **Managed**. Pre-clearance: off. **Create**.
3. Read the site key (it is public):
   ```js
   const v = [...document.querySelectorAll('input')].map(i => i.value).filter(v => /^0x4/.test(v))
   v[0].split('').join(' ')   // spaced, or the extension blocks it as base64
   ```
   Confirm against a zoomed screenshot of the "Site key" box.

**Owner:** "Click the Secret key box in that tab to copy it. We'll paste it
into Apps Script in a minute."

Local testing uses Cloudflare's test site keys instead of the real one (the
real key only works on its hostname): `1x00000000000000000000AA` always
passes invisibly, `3x00000000000000000000FF` always shows the challenge.
Restore the real key before building for production.

## 4. Google Apps Script

**Claude, create and load:**
1. Open `https://script.google.com/home/projects/create` in the Google account
   that owns the Sheet. Click **OK** on "You're currently signed in as".
2. Click the title "Untitled project" > rename to `<Brand> Signups`.
3. Gear icon (Project Settings) > check **Show "appsscript.json" manifest file
   in editor** > back to the editor (`<>` icon).
4. **+** next to Files > **Script** > type `Config` > Enter. If the name box
   still says "Untitled", select it and type again. Repeat for `Emails`.
   (Code.gs exists already.)
5. Inject a file input and load the local files:
   ```js
   const inp = document.createElement('input')
   inp.type = 'file'; inp.multiple = true; inp.id = 'src-files'
   inp.setAttribute('aria-label', 'source files')
   inp.style.cssText = 'position:fixed;top:0;left:0;z-index:99999'
   document.body.appendChild(inp)
   ```
   `find` "source files file input", `file_upload` Config.gs, Code.gs,
   Emails.gs, appsscript.json, then:
   ```js
   const inp = document.getElementById('src-files'); window.__src = {}
   for (const f of inp.files) window.__src[f.name] = await f.text()
   inp.remove()
   window.__sha = async t => [...new Uint8Array(await crypto.subtle.digest('SHA-256',
     new TextEncoder().encode(t)))].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
   ```
6. For each file: click it in the Files list (by `find` ref), then
   ```js
   const ed = monaco.editor.getEditors()[0], m = ed.getModel()
   ed.executeEdits('load', [{ range: m.getFullModelRange(), text: window.__src['Code.gs'] }])
   ed.pushUndoStop(); await window.__sha(m.getValue())
   ```
   The hash must equal `shasum -a 256 Code.gs | cut -c1-16`. Cmd+S. Check the
   header reads "Saved to Drive".

**Claude, first deploy:** **Deploy** > **New deployment**. The manifest fills in
Web app, Execute as Me, Who has access Anyone. Description "First deploy" >
**Deploy** > the dialog asks to authorize. Stop here.

**Owner, authorize** (give them this):
> In the Apps Script tab, click **Authorize access**, pick **<account>**. Google
> says "Google hasn't verified this app": click **Advanced**, then **Go to
> <Brand> Signups (unsafe)**, then **Allow**. The warning is normal for your own
> script. The permissions are: Sheets (write the signup row), send email (only
> used if Resend is not set up), external services (Resend and Cloudflare), and
> triggers (only for follow-up emails).

**Claude, read the URL:**
```js
[...new Set([...document.querySelectorAll('a[href*="/macros/s/"]')].map(a => a.href))]
```
Put it in `Config.gs` `webAppUrl`, `signup.js` `ENDPOINT`, and the unsubscribe
page's `ENDPOINT`. Run the no-email curl checks (SKILL.md Phase 5).

**Owner, Script Properties** (Project Settings gear > scroll to Script
Properties > **Add script property** for each > **Save script properties**):

| Property | Value |
|---|---|
| `RESEND_API_KEY` | the Resend key |
| `RESEND_FROM` | `<Brand> <hello@mail.<domain>>` (the whole thing, brackets included, no quotes) |
| `TURNSTILE_SECRET` | the Turnstile secret key |

No redeploy is needed for properties; they are read on every request.

**Claude, redeploy after any code change** (gotchas 1, 2, 7):
1. Update the file in the editor (whole file, or `findMatches` on the changed
   block), check the hash, Cmd+S, confirm "Saved to Drive".
2. **Deploy** > **Manage deployments** > pencil (Edit) > Version combobox >
   **New version**. Do not touch Description.
3. Read back `document.querySelector('[role=dialog] [role=combobox]').innerText`:
   must say "New version". Then **Deploy**.
4. Read the dialog: "Version N on <date>" with N one higher. Click **Done**.
5. `curl -sL "$URL"` still returns the health check.

## 5. Cloudflare DNS hardening

**Claude:**
1. `https://dash.cloudflare.com/<account id>/<domain>/dns/records`. Read what is
   there. Note any MX or TXT `v=spf1` on the root (`@`).
2. **Add record** > Type: click the Type box, choose **TXT** from the list
   (clicking elsewhere closes the dialog) > Name `_dmarc` > Content
   `v=DMARC1; p=none;` > **Save**. Skip if a DMARC record exists.
3. Only if the root has no MX and no SPF (it sends no mail): **Add record** >
   TXT > Name `@` > Content `v=spf1 -all` > **Save**.
4. Verify: `dig +short TXT _dmarc.<domain> @1.1.1.1` and `dig +short TXT <domain> @1.1.1.1`.

## 6. Owner's live test

Hand over:
> 1. Open an **incognito** window and go to <site>. Sign up with your own
>    address. You probably won't see a Cloudflare checkbox; that's normal.
> 2. You should get: the thank-you screen with download buttons, the email in
>    your inbox (check spam), and a "New signup" notice at <owner address>.
> 3. In Gmail, open the email > **⋮** > **Show original**. Check **DKIM: PASS**
>    and **DMARC: PASS**.
> 4. Click **Unsubscribe** at the bottom of the email and press the button.
>    You should get an "Unsubscribed" notice, and your row should say
>    `unsubscribed`.
> 5. Sign up again with the same address. The row goes back to `active`. No
>    second email inside an hour; that's the anti-flooding cooldown.
