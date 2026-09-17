# Gotchas

From the first build (mikehaslam.com, 2026-09-16). Read before Phase 2 and
again before the live test. Add to this list after every client build.

## Apps Script

**1. Open the editor from the Sheet.** Extensions > Apps Script creates a
script bound to that Sheet, which is how `SpreadsheetApp.getActiveSpreadsheet()`
finds it with no ID. A project started at script.google.com is unbound and the
tabs can't be found.

**2. Saving does not change the live script.** The web app serves a pinned
version. After any code change: Deploy > Manage deployments > pencil > Version:
New version > Deploy. Choose New version *last*: editing the description after
picking it flips the version back and Deploy rolls the site back. The URL stays
the same.

**3. `Missing tab "Settings". Run setup() first.`** Exactly what it says:
`setup()` never ran in this Sheet. On the site this shows as `could not load
times`.

**4. The manifest checkbox is easy to miss.** Project Settings > "Show
appsscript.json manifest file in editor" is the third checkbox. Without the
manifest, the Calendar advanced service is off and the log says `Calendar is
not defined`.

**5. Permissions granted before the manifest miss Calendar.** If
`appsscript.json` was pasted after the first run, run `previewSlots` again to
get the Calendar prompt. "Google hasn't verified this app" is normal for the
owner's own script: Advanced > Go to Booking.

**6. Several Google accounts in one browser.** `/u/3/` in the URL means the
project may be in the wrong account. The calendar that gets booked, and the
heads-up address, follow whichever account owns the script.

**6b. "It's not on my calendar."** In the first live test the owner was
looking at a different Google account's calendar. The **Event link** column on
the Bookings tab opens the event in the account that owns it; check the avatar
there. A refused second booking of the same time also proves the event exists.

**7. Google loses about one reply in fifteen.** The POST runs, then the
redirect to googleusercontent.com sometimes returns the health check or a
Drive error page. `bookingApi.js` treats that as lost and retries with the
**same booking ID**; `Code.gs` caches each booking's answer for 6 hours, so a
retry never makes a second event. Don't simplify `request()` to
`response.json()`.

**8. Script Properties apply immediately.** Adding `TURNSTILE_SECRET` or
`OWNER_EMAIL` needs no redeploy.

**8b. Every request takes one to five seconds.** Measured live: a do-nothing
health check 1.1 to 1.7s, a rejected booking 1.7 to 5.3s, loading times 1.4 to
3.5s. A taken slot therefore spins for several seconds before the notice. Set
that expectation with the owner; it is Apps Script, not the site.

## Calendar

**9. All-day events block nothing.** Google marks them "Free" by default, and
free/busy ignores them. Use the Days off tab, or set the event to Busy.

**10. An unreadable calendar fails closed.** If a calendar in "Calendars to
check" isn't shared with the booking account, the script throws and the site
shows `could not load times` rather than offering times that might be busy.
Share at least "See only free/busy".

## Site and tooling

**11. A global gitignore can hide the config.** On a Mac, a `Config` rule in
`~/.gitignore_global` matched `src/config/` case-insensitively; `git add`
aborted and a host build would miss the file. Check with
`git check-ignore -v src/config/booking.js`, force-add that one file, and build
a clean `git archive` export before pushing.

**12. Claude's preview pane tab runs hidden.** Timers and IntersectionObserver
are throttled, so animations stall mid-way and screenshots look broken. Inject
a style that zeroes animation and transition durations before screenshots, or
capture with headless Chrome.

**13. Tailwind `important: true` beats `v-show`.** A `grid`/`flex` utility on
a `v-show` root overrides the inline `display:none`. The modal uses scoped CSS
and class-free `v-show` roots for this reason; keep it that way when restyling.

**14. `text-wrap: balance` still breaks at hyphens.** "30-minute" split across
lines on phones. The title default uses U+2011 (non-breaking hyphen).

**15. Turnstile only works on the widget's hostnames.** Local dev uses stub
mode (empty endpoint), and the live booking test has to run on a listed
domain.

## Cloudflare dashboard

**16. Enter doesn't add a hostname.** It clears the field. Click the dropdown
option `Add "<host>" as a custom hostname`. A leftover "At least 1 hostname
must be added" message can linger after adding; it clears on Create.

**17. Pick the right account.** The account picker lists client accounts too
(Mike's included Green Papaya's). The widget belongs in the business's own
account.

## Sheet

**18. Times stay text.** `setup()` formats the Hours times as plain text and
Days off as `yyyy-mm-dd`, and the script reads display values, so `9:00 AM`
never becomes a date serial. Parsing accepts `9:00 AM`, `9 am`, `17:00`,
`10/12/2026` and `2026-10-12`.

**19. Days off is one row per date.** No ranges.

## Email

**20. MailApp quota counts heads-ups.** Consumer Gmail sends to about 100
recipients a day, Google Workspace about 1,500. A booking-heavy business on
consumer Gmail should move to Workspace.
