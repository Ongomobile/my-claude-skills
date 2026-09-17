---
name: list-engine
description: Guided, step-by-step build of a website signup form that saves each person to a Google Sheet, emails them instantly through Resend from the client's own domain (optionally with download links to files hosted on Cloudflare R2), notifies the owners of every signup and unsubscribe, handles unsubscribe properly (footer link page plus Gmail/Yahoo one-click), and lets the owners send list emails (broadcasts) to every active subscriber by writing them in the Sheet, paced to Resend's free daily limit, with Cloudflare Turnstile bot protection and DKIM/SPF/DMARC set up. Use whenever the user wants a lead magnet, free guide or PDF download for an email, coupon delivery, newsletter or mailing list signup, waitlist that emails people, a newsletter or "email my whole list" feature, "form to Resend", "form to Google Sheet with emails", "send a download link when someone signs up", or wants to repeat this signup setup for another site or client. Also use to add list emails (broadcasts) to a signup system built with this skill or its earlier name, resend-sheet-form. Prefer this over sheet-form whenever the emails must come from the client's domain, include downloads, or need unsubscribe; use sheet-form for a simple contact form that only emails the owner.
user-invocable: true
---

# list-engine

Walks the user through wiring a signup form end to end, one phase at a time,
doing the build and dashboard work and handing them only what is theirs.

```
form ──POST──> Apps Script Web App ──> Google Sheet (Signups tab)
                   │   Turnstile check      │
                   ├──> Resend ──> subscriber: welcome email + download links (files.<domain> on R2)
                   └──> Resend ──> owners: "New signup" / "Unsubscribed"
email footer ──> <site>/unsubscribe/?u=TOKEN ──button──> Apps Script ──> row marked unsubscribed
Gmail/Yahoo one-click (List-Unsubscribe header) ──POST──> Apps Script
Broadcasts tab (owner sets Status) ──on edit / hourly──> Apps Script ──> Resend ──> active subscribers, paced
```

Everything is free-tier: Apps Script, Sheets, Resend free plan, R2, Turnstile.
It requires the site's domain to be on Cloudflare DNS (R2 custom domain,
Turnstile, DNS records). If it is not, say so in Phase 0 before building.

## Requirements

- **Accounts the owner creates and keeps:** Google (Sheet and Apps Script),
  Resend, and Cloudflare holding the domain. Each build uses the client's own
  accounts, never Claude's or the builder's.
- **Node** for the two test scripts.
- **Claude in Chrome (recommended, not required).** With the extension, Claude
  does the dashboard work itself in its own tab group, signed in as the owner:
  R2, Turnstile, DNS, and loading, deploying and running Apps Script. Ask in
  Phase 0 whether it is installed and connected.

### Without Claude in Chrome

Everything still works. Claude writes the code, runs the tests, and checks the
live pieces from the terminal (`curl`, `dig`); the person does every dashboard
step by hand from `click-paths.md`, one step at a time, and says when each is
done. Differences:

- **Apps Script:** instead of injecting files, open each file in the editor,
  select all, and paste the local file in (copy it with `pbcopy < Config.gs`
  on a Mac). Pasting is safe; typing code is not (gotcha 5). Check the
  editor's last line number matches `wc -l` of the file. Then Deploy and
  Run exactly as written. Google's `clasp` CLI can push the files and redeploy
  from the terminal instead, but it needs its own sign-in, and running
  `setupBroadcasts` and authorizing still happen in the editor.
- **R2:** the person creates the bucket and drags the files in, or Claude uses
  Cloudflare's `wrangler` CLI after the person runs `wrangler login`.
- **Turnstile and DNS:** by hand in the Cloudflare dashboard. The person pastes
  the public site key into chat; Claude verifies DNS with `dig`.
- **Checks Claude would read on screen** (Resend's delivered list, the
  Triggers page, the Sheet tabs): ask the person to look and report back, or
  send a screenshot.

It takes longer and has more hand-offs, so say that up front.

## Bundled files

| Path | What |
|---|---|
| `templates/apps-script/Config.gs` | The only backend file edited per project: brand, addresses, email copy, downloads, colors |
| `templates/apps-script/Code.gs`, `Emails.gs` | The engine. Do not edit per project |
| `templates/apps-script/Broadcasts.gs` | List emails written in the Sheet: tabs, triggers, pacing, log. Do not edit per project; settings live in `BROADCASTS` in Config.gs |
| `templates/apps-script/appsscript.json` | Pins OAuth scopes and web app access. Set `timeZone` per client |
| `templates/site/signup.js` | Framework-free client: `submitSignup()` with Google's lost-reply retry |
| `templates/site/turnstile.js` | `createTurnstile()`: load, token wait, reset |
| `templates/site/signup-form.html` | Reference form wiring (plain HTML); port to the site's stack |
| `templates/site/unsubscribe/index.html` | The footer link's landing page |
| `templates/site/demo.html` | Demo mode: the signup form on pretend replies, plus links to the email previews. Opens from disk |
| `templates/site/demo-emails/` | Welcome and list email previews for the demo, built with `--sample` |
| `templates/owner-guide.html` | Plain-language guide to the Sheet and list emails for whoever runs the list |
| `scripts/test-backend.js` | Runs the backend in Node against fake Google services, 34 checks |
| `scripts/test-broadcasts.js` | Runs Broadcasts.gs the same way: setup, test, pacing, resume, unsubscribes, outages, 47 checks |
| `scripts/preview-emails.js` | Renders the welcome and list emails from the real templates into HTML pages. Nothing is sent |
| `references/click-paths.md` | Exact dashboard clicks and the wording to hand the owner |
| `references/gotchas.md` | 28 things that broke or bite. Read before Phase 5 |

## How to run this with the user

- **One question at a time** in Phase 0, with a recommended default.
- **End every phase with a checkpoint:** what was done, what was verified and
  how, and what is next. Wait for a go-ahead before the next phase.
- **Claude does:** code, tests, commits, and dashboard work in its own Chrome
  tab group (R2, Turnstile, DNS, loading and deploying Apps Script). Without
  Claude in Chrome, the dashboard work moves to the person; see Requirements.
- **The owner does, with exact clicks from `click-paths.md`:** creating
  accounts, adding payment methods, signing in, Google's authorization screen,
  creating and pasting secret keys, and the live signup test. Claude never
  enters a secret, never clicks a consent screen, never completes a bot check.
- **Real email only with permission.** Name the addresses that will receive it.
- Keep copy free of em dashes; it is the user's standing rule.

## Phase 0: Interview

Ask one at a time; skip anything already known from the project or earlier chat.

0. **Claude in Chrome.** Is the extension installed and connected? If not,
   explain the by-hand path (Requirements) and confirm they are fine with it.
1. **Site and stack.** Which repo/folder, what framework, where it is hosted,
   and is the domain's DNS on Cloudflare? Which Cloudflare account holds it?
2. **Sheet.** New or existing Sheet, and **which Google account owns it**? The
   Apps Script project must be created in that same account.
3. **Fields.** Default: name and email. Every extra field becomes a column and
   needs code in `Code.gs` (COL/HEADERS and the appendRow).
4. **Downloads.** Any files? Which, and should there be a zip of all of them?
   None is fine: the email becomes a plain welcome/confirmation.
5. **Addresses.** Who gets owner notices, and where should subscriber replies go?
6. **Postal address** for the CAN-SPAM footer (PO box counts).
7. **Resend.** Whose account? Recommend one the client owns. Emails will come
   from `hello@mail.<domain>` unless they want another name.
8. **Follow-up emails.** Default off (drafts stay in `sequenceDraft`).
9. **List emails (broadcasts).** Default on. Who will write them (their Sheet
   access), and does anything else send through the same Resend account? That
   sets `BROADCASTS.dailyLimit`: 60 on a free account of its own, lower if
   shared, higher on a paid plan.
10. **Email copy.** Draft the subject, intro, per-file text and sign-off in the
   brand's voice, show it rendered (Phase 1 step 4), and get approval now. Changing it later costs a
   redeploy.

Checkpoint: summarize the answers as a short table and confirm.

## Phase 1: Backend code

1. Copy `templates/apps-script/*` into the project (e.g. `apps-script/`).
   Commit it with the site: it is the source of truth; Google holds a copy.
2. Fill in every `FILL_ME` in `Config.gs` from Phase 0. Download URLs are
   `https://files.<domain>/<file>`. Set `timeZone` in `appsscript.json`.
   Add a second entry to OFFERS only if the site has more than one form.
3. Run `node <skill>/scripts/test-backend.js <project>/apps-script`. It fails
   on any leftover `FILL_ME` and notes the unset `webAppUrl` (fine for now).
   All other checks must pass. Then
   `node <skill>/scripts/test-broadcasts.js <project>/apps-script`: all pass.
4. Render the emails for the owner:
   `node <skill>/scripts/preview-emails.js <project>/apps-script <scratch folder>`,
   open the pages, and get the copy approved before anything is deployed.
   Buyers who want to see the whole thing first can open
   `templates/site/demo.html` from disk.

Checkpoint: config values, the approved copy (rendered previews), test output.

## Phase 2: Downloads on R2 (skip if no files)

Owner enables R2 if never used. Claude creates the bucket, uploads the files
(and zip), connects `files.<domain>`, and verifies with curl and checksums.
Click path: `click-paths.md` §1.

Checkpoint: the public URLs, each returning 200 with a matching checksum.

## Phase 3: Resend (owner)

Hand over `click-paths.md` §2. While they wait on "Pending", run the dig checks
from the same section and tell them whether the records are already live.

Checkpoint: domain Verified in Resend, key created (not shared in chat).

## Phase 4: Turnstile

Claude creates the widget and reads the public site key (`click-paths.md` §3).
The owner copies the secret key for Phase 5.

Checkpoint: site key recorded in `signup.js`; owner has the secret.

## Phase 5: Apps Script

Read `references/gotchas.md` first. Then `click-paths.md` §4:

1. Create the project in the Sheet owner's account, load the five files by
   injection, verify each hash, save.
2. First deploy. Owner authorizes.
3. Read the Web App URL. Put it in `Config.gs`, `signup.js`, and the
   unsubscribe page. Owner adds the three Script Properties.
4. Update Config.gs in the editor, redeploy as New version (gotcha 2).
5. Turn on list emails: run `setupBroadcasts` (`click-paths.md` §7), check the
   two triggers and two tabs, redeploy New version.
6. No-email checks against the live URL:
   ```bash
   URL='<web app url>'
   curl -sL "$URL"                                                          # {"ok":true,"service":...}
   curl -sL --data-raw '{"email":"nope"}' "$URL"                            # invalid email
   curl -sL --data-raw '{"email":"a@b.co","turnstileToken":"x"}' "$URL"     # verification failed
   curl -sL --data-raw '{"email":"a@b.co","company":"bot"}' "$URL"          # {"ok":true}, no row
   curl -sL --data-raw '{"action":"unsubscribe","token":"ffffffffffffffffffffffffffffffff"}' "$URL"  # {"ok":true}
   ```
   Expect roughly 1 in 15 to come back as the health check or an HTML page
   (gotcha 3). That is Google, and the client handles it.

Checkpoint: live URL, deployed version number, curl results.

## Phase 6: Website

1. Copy `signup.js` and `turnstile.js` into the site; fill `ENDPOINT`,
   `TURNSTILE_SITE_KEY`, and `DOWNLOADS` (same files as Config.gs).
2. Build the form from `signup-form.html` in the site's own stack and design
   system. Keep: honeypot, no fake success, downloads on the thank-you screen,
   16px+ inputs, aria-live messages. If the site had a stub or fake-success
   mode, restrict it to local dev only.
3. Put `unsubscribe/index.html` where the site serves `/unsubscribe/`, fill its
   `ENDPOINT` and `FILL_ME`s, restyle its tokens to the brand.
4. Test locally before deploying, with Cloudflare's test site key in place of
   the real one and `window.fetch` mocked to return, in turn: an HTML page then
   a good reply (expect 2 posts, success), `{"ok":true,"service":"signups"}`
   (success, fallback downloads), `{"ok":false,"error":"verification failed"}`
   (error shown), and the unsubscribe page with HTML then `{"ok":true}`. Check
   a 375px phone width with the always-challenge key (`3x...FF`): no sideways
   scroll, even spacing. Restore the real key and confirm it is in the build.
5. Commit and push (or deploy). Poll the live site until the new bundle and
   `/unsubscribe/` are served.

Checkpoint: the four mocked results, phone screenshot, live bundle confirmed.

## Phase 7: DNS hardening

`click-paths.md` §5: DMARC `p=none` always; root `v=spf1 -all` only if the
root domain sends no mail (gotcha 12). Verify with dig.

Checkpoint: records resolving.

## Phase 8: Go live

Get permission, then hand the owner `click-paths.md` §6 (Claude's browser gets
the Turnstile checkbox and must not click it). Confirm with them, item by
item: thank-you screen with downloads, subscriber email, owner notice, Sheet
row, DKIM and DMARC PASS, unsubscribe plus notice, resubscribe sets `active`.
Then, with permission, one broadcast `test` to `BROADCASTS.testTo`
(`click-paths.md` §7). Never a real `send` as a test: it goes to everyone.

If something is off: stale tab (gotcha 19), missing Script Property (the curl
returns "verification failed" for real signups, or Resend errors appear under
Executions in Apps Script), wrong deployed version (gotcha 2).

## Handoff

- In the project's `apps-script/` folder, add a README with a **live values**
  table: Sheet, script project name and owning Google account, Web App URL,
  R2 bucket and domain, Resend account and sending domain, owner notice
  address, Turnstile widget, Cloudflare account. Then: how to change email
  copy (edit Config.gs, paste, redeploy New version), and where the secrets
  live (Script Properties only).
- Copy `templates/owner-guide.html` into the project (next to `apps-script/`),
  fill in every `{{...}}` from Config.gs, and give it to whoever runs the list.
  Make sure the Sheet owner has shared the Sheet with them as Editor.
- Save a project memory with which account owns each piece; it is not
  guessable later.
- Close Claude's Chrome tabs.
- Optional next steps to offer, not do: tighten DMARC to `quarantine`, write
  and enable the follow-up sequence.

## Adding list emails to an existing install

For a site built with this skill before `Broadcasts.gs` existed:
1. Copy `templates/apps-script/Broadcasts.gs` into the project's `apps-script/`
   and append the `BROADCASTS` block from the template `Config.gs` to its
   Config.gs, with `dailyLimit` set as in Phase 0 question 9. Nothing else in
   the engine changes; older installs with a different OFFERS shape work too.
2. `node <skill>/scripts/test-broadcasts.js <project>/apps-script`: all pass.
3. In the live editor: add a `Broadcasts` script file, load Broadcasts.gs and
   Config.gs by injection with hash checks (`click-paths.md` §4), save, then
   §7: run `setupBroadcasts`, check triggers and tabs, redeploy New version.
4. Owner shares the Sheet and gets the filled-in owner guide. Test with permission.
