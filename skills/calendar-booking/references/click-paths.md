# Click paths

Hand these to the owner one step at a time, in plain words. Wait for each
answer before the next step.

## §1 Sheet and Apps Script (owner)

Before starting: the owner is signed in to the Google account whose calendar
takes the bookings. If the address bar shows `/u/1/`, `/u/2/`... they are in
several accounts; have them click the avatar top right and confirm (gotcha 6).

1. **Create a blank Google Sheet** in that account. Name it something like
   "<Business> Bookings".
2. **Open the script editor from the Sheet:** Extensions > Apps Script. Rename
   the project "Booking". (Starting from script.google.com creates an unbound
   script that can't find the Sheet, gotcha 1.)
3. **Show the manifest:** gear icon (Project Settings) > tick **Show
   "appsscript.json" manifest file in editor**. It's the third checkbox, under
   "Enable Chrome V8 runtime". Owners often think it's missing (gotcha 4).
4. **Paste three files**, each into its own file, never all in one:
   - `Code.gs` already exists with `function myFunction() {}`. Replace
     everything with `Code.gs`.
   - **+** next to Files > **Script**, name it `Slots`, paste `Slots.gs`.
   - Open `appsscript.json`, replace everything.
   - **Save**.
5. **Run `setup`:** pick `setup` in the function dropdown, **Run**. Approve:
   Review permissions > the account > Allow. If "Google hasn't verified this
   app": Advanced > Go to Booking. Four tabs appear in the Sheet.
6. **Fill in Settings:** Business name, Meeting title, and any values from the
   interview that differ from the defaults. Hours tab too.
7. **Run `previewSlots`.** The Execution log lists the next ten open times.
   Any red error: have them copy it to you.
8. **Deploy:** Deploy > New deployment > gear > **Web app**. Execute as:
   **Me**. Who has access: **Anyone**. **Deploy**. Copy the **Web app URL**
   (ends in `/exec`) and send it.

Later code changes: Deploy > Manage deployments > pencil > **Version: New
version** chosen last > Deploy (gotcha 2). Script Properties never need a
redeploy.

## §2 Turnstile (Claude, in its own Chrome tab group)

1. `dash.cloudflare.com`. If an account picker appears, choose the business's
   own account, not a client's (gotcha 17). Then open
   `https://dash.cloudflare.com/<account-id>/turnstile`.
2. Check the widget list for an existing one on these hostnames first.
3. **Add widget manually.**
   - Widget name: `<domain> booking`.
   - Hostnames: type each one and click the **Add "<host>" as a custom
     hostname** option. Enter clears the field without adding (gotcha 16).
     Add the apex, `www`, and any preview domain the live test will use.
   - Widget mode: **Managed**. Pre-clearance: off.
   - **Create**.
4. Read only the **Site key** textbox (a `find` for "Site key value" returns
   it). Do not screenshot or read the secret.
5. Tell the owner: on that same page, click the copy icon next to **Secret
   key**. If the page closed: Application security > Turnstile > the widget.
   In Apps Script: Project Settings > Script Properties > Add script property:
   `TURNSTILE_SECRET` = the secret > **Save script properties**. Never in chat.

## §3 Live test (owner, after the push)

Use a second email address the owner can check.

1. Open the live site, click a booking button, pick a time at least a day
   out, fill the form, book.
2. Confirm, one at a time:
   - The "You're booked" screen shows the right time in their zone.
   - The event is on the owner's calendar with a Meet link and the answers
     in the description. Have them open it from the **Event link** column on
     Bookings, so they land in the right Google account (gotcha 6b).
   - The second address got the Google Calendar invite.
   - The owner got the "New call booked" heads-up.
   - A row landed on the Bookings tab.
3. Open the modal again: that time and the 30 minutes either side are gone.
4. Add tomorrow to Days off; within a minute tomorrow is dimmed.
5. Delete the test event (Send the cancellation) and the Days off row.
