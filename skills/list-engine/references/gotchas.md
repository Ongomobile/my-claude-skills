# Gotchas

Every one of these cost real time on the first live build (2026-09-16),
or is a trap in the list-email feature added the next day. Read this before
Phase 5 (Apps Script) and again before Phase 8 (live test).

## Apps Script

**1. Saving does not change the live script.** A Web App serves a pinned
version. After any code change: Deploy > Manage deployments > pencil > Version:
New version > Deploy. Same URL. If "my change did nothing", check this first.

**2. The version picker resets itself.** In Manage deployments, typing in the
Description field after choosing "New version" silently flips the Version back
to an old one, and Deploy then *rolls the live script back*. Choose New version
as the last action, read the combobox text back (`[role=dialog]
[role=combobox]`), then click Deploy, then confirm the result says "Version N"
with N one higher than before. Leave the description alone.

**3. Google loses about 1 reply in 15.** doPost runs, then Google redirects the
browser to googleusercontent.com to fetch the stored reply. Sometimes that
fetch bounces back to /exec (the browser gets doGet's health check) or returns
a Drive "Sorry, unable to open the file" page. The row and email already
happened. `signup.js` and the unsubscribe page handle both cases; do not
"simplify" `readReply` back to `response.json()`. It shows up only under
repeated testing, so test with 15+ requests, not 3.

**4. "You're currently signed in as ..." dialog** appears on opening the
editor and swallows the first click or Cmd+S. Click OK, then act. Confirm the
header says "Saved to Drive" before deploying.

**5. Never type code into the editor.** Monaco auto-indents and auto-closes,
so typed code arrives mangled. Load files through an injected file input and
`executeEdits` (click path in `click-paths.md`), then compare a SHA-256 of the
editor contents with `shasum -a 256` of the local file.

**6. The authorization screen belongs to the owner.** "Authorize access" opens
Google's consent flow for their account. Stop and give them the clicks; never
click through it.

**7. Background tabs break coordinate clicks.** Menus and dialogs in a Chrome
tab the user is not looking at often do not render in screenshots, and clicks
by coordinate miss. Use `find` refs for every click in the deploy dialog.

**8. The script runs as whoever deployed it** and must be able to open the
Sheet. Create the Apps Script project in the same Google account that owns the
Sheet. Ask; do not assume it is the business Gmail.

## Resend and email

**9. Resend refuses a root domain.** Add `mail.<domain>` instead. Emails then
come from `hello@mail.<domain>`; replies still go wherever `replyTo` says.

**10. Secrets never touch the repo, a .env file, or the chat.** The Resend API
key and Turnstile secret go only into Apps Script Script Properties, pasted by
the owner. Anything in a site's .env ends up in the public bundle. The Web App
URL and Turnstile site key are public and belong in code.

**11. One API key per project,** Sending access only, scoped to the one
domain. A leak or revocation then touches nothing else. Projects in one Resend
account share its sending limits (free: 100 a day, 3,000 a month).

**12. Root SPF `-all` only if the root domain sends no mail.** Check for an
existing SPF or MX record (Google Workspace, Microsoft 365, Zoho, a host's
mailbox) first. `-all` on a domain that does send mail breaks that mail.
DMARC `p=none` is safe everywhere; tighten to `quarantine` only after a real
email shows DKIM and DMARC pass.

**13. CAN-SPAM** wants a real postal address and a working opt-out in every
commercial email, the first one included. A PO box counts. A market booth
only counts if mail is delivered there. The footer in `Emails.gs` carries both.

## Cloudflare

**14. R2 needs a payment method on file** even on the free tier. The owner
enables R2; Claude creates the bucket after.

**15. `file_upload` caps at 10 MB per call.** Upload large files one at a time,
or have the owner drag them into the bucket.

**16. The Turnstile site key reads as base64** to the Chrome extension, which
blocks it from JS output. Read it as spaced characters
(`value.split('').join(' ')`) and confirm with a zoomed screenshot.

**17. Turnstile shows "Verify you are human" to Claude's browser.** Automated
browsers nearly always get the checkbox. Clicking it is completing a bot check,
which Claude must not do. The live signup test is the owner's, in a normal (or
incognito) browser, where the widget is usually invisible.

**18. Pick the right Cloudflare account.** People often have several. The
bucket, Turnstile widget and DNS changes must be in the account that holds the
domain; the custom-domain preview confirms it by showing the zone.

## Testing

**19. A tab opened before the deploy runs the old code.** Opening a modal does
not reload the page. Test in an incognito window or after Cmd+Shift+R.

**20. Vite's dev server answers `/unsubscribe/` with the home page** (SPA
fallback). Test locally at `/unsubscribe/index.html`. Cloudflare serves the
folder index correctly in production.

**21. curl against Apps Script: `curl -sL --data-raw '...'`, never `-X POST`.**
`-X POST` re-POSTs to the redirect and returns a Drive error page that looks
like a broken deployment.

**22. The one-hour cooldown is per address.** A second signup inside an hour
sends no email (by design, it stops inbox flooding) but does set an
unsubscribed row back to active. Test resubscribe emails after an hour, or
edit `lastGuideSentAt` in the Sheet.

**23. The user's own Chrome tabs are invisible to Claude.** Claude's tab group
starts empty. Open your own tab, and close it when done, especially one showing
a secret key.

## List emails (broadcasts)

**24. Triggers run as whoever created them.** Run `setupBroadcasts` signed in
as the Sheet owner. Edits by other people still fire `onBroadcastEdit`, but the
send runs as the owner, on the owner's quotas.

**25. An edit during a send waits for the hourly run.** Only one broadcast run
works at a time (the `BROADCAST_RUNNING` script property). A `test` picked
while a send is going out arrives within the hour, not within the minute.

**26. Script edits never fire `onEdit`.** Setting a Status from code, or from
another app writing to the Sheet, does not start a send until the hourly run.
In testing, set Status by hand in the Sheet or call `runBroadcasts` directly.

**27. The Broadcast log is the memory.** A paced send knows who already has the
email only from the log. Deleting log rows mid-send re-sends to those people.
Clearing the log after sends finish is safe.

**28. Resend's free daily limit is per account, not per project.** Set
`BROADCASTS.dailyLimit` from what else sends through that account, leaving
room for every signup's guide email and owner notice.
