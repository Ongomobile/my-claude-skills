# The forms backend

Every form on this site posts to one Google Apps Script Web App. The script
writes a row to a tab in a Google Sheet and sends two emails: one back to the
person who filled the form in, one to the owner.

There is no server. The site is static. Google does the work, for free.

## First time setup

**1. Make the Sheet.** Any new Google Sheet. Name it something you will
recognise. Do not add headings — the script makes each tab, with its headings
frozen, the first time that form is used.

**2. Open the script from inside the Sheet.** Extensions > Apps Script. It has
to be opened this way. A standalone script is not attached to any Sheet and
`SpreadsheetApp.getActiveSpreadsheet()` will fail.

**3. Paste the code.** Delete what is in `Code.gs` and paste all of
`apps-script/Code.gs` from this repo. Rename the project at the top so you can
find it later. Save. Check the header says **Saved to Drive** — if a "you're
signed in as" popup appeared, it ate the save. Dismiss it and save again.

**4. Deploy.** Deploy > New deployment > the gear > **Web app**.

- Description: anything.
- Execute as: **Me**.
- Who has access: **Anyone**. Your visitors are not signed in to Google.

Press Deploy.

**5. Authorise.** Google asks for permission, in a separate window.

- Pick your account.
- "Google hasn't verified this app" — click **Advanced**, then
  **Go to \<project name\> (unsafe)**. This is your own script. The warning is
  what Google shows for any script that has not been through its review, which
  a private one never is.
- **Allow.** It asks to edit that spreadsheet and to send email as you. It needs
  both: one to write the row, one to send the emails.

**6. Copy the Web app URL** and put it in `.env`:

```
VITE_FORMS_ENDPOINT=https://script.google.com/macros/s/…/exec
```

**7. Put the same variable in your host.** On Cloudflare Pages: Settings >
Environment variables, add it to Production and Preview, then redeploy. Miss
this and the live site ships with a dead form even though it works locally.

## Turnstile (spam protection)

Optional but recommended on Cloudflare.

1. Cloudflare dashboard > Turnstile > Add widget. Domain: your site.
2. The **site key** is public. Put it in `.env` as `VITE_TURNSTILE_SITE_KEY`,
   and in the host's environment variables too.
3. The **secret key** is private. In Apps Script: Project Settings > Script
   Properties > Add script property, name `TURNSTILE_SECRET`. It must not go in
   `Code.gs` or the repo.
4. Redeploy the script (see below).

## Changing anything later

**Saving is not deploying.** Editing `Code.gs` and pressing Save changes nothing
for visitors. The live URL is pinned to a version.

To push a change live: **Deploy > Manage deployments > the pencil > Version:
New version > Deploy.** Same URL, same deployment ID, new code.

Edit `apps-script/Code.gs` in this repo first, then paste it over. The repo copy
is the source of truth. The one in Google is a build artifact.

## Checking it works

Open the Web app URL in a browser. You should see:

```json
{"ok":true,"service":"forms"}
```

Then use the form on the site and check three things: a row appeared in the
right tab, both emails arrived, and pressing **reply** on the owner email
addresses the sender rather than yourself.
