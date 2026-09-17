---
name: calendar-booking
description: Guided, step-by-step build of a branded booking calendar for a website, replacing Calendly, Setmore, Acuity or similar. Visitors pick a time in their own time zone inside an on-brand modal and are booked instantly on the owner's Google Calendar with a Google Meet link and a Google invite, plus a heads-up email to the owner and a row in a Google Sheet. The owner edits hours, gaps, notice and days off in that Sheet, never in code. Backend is one Google Apps Script bound to the Sheet, with Cloudflare Turnstile bot protection; no monthly fees. Use whenever the user wants a booking page, "book a call" or "schedule a consultation" button, appointment scheduling, a discovery call calendar, "Hire me" that opens a calendar, a Calendly/Setmore replacement, or wants to repeat the mikehaslam.com booking setup for another site or client. Not for multi-staff scheduling, paid bookings, or in-person appointment businesses needing resources and locations.
user-invocable: true
---

# calendar-booking

Walks the user through a branded, instant-booking calendar end to end, one
phase at a time, doing the build and dashboard work and handing the owner only
what is theirs.

```
Button ─> BookingModal (site brand) ──GET ?action=slots──> Apps Script ─> Settings/Hours/Days off tabs
                                                               └─> Google Calendar free/busy
         pick time + details + Turnstile ──POST book──> Apps Script: verify, lock, re-check slot
                                                               ├─> Calendar event + Meet link, guest invited by Google
                                                               ├─> Bookings tab row
                                                               └─> heads-up email to the owner
```

Free-tier throughout: Apps Script, Sheets, Calendar, Turnstile. The site can be
hosted anywhere (Netlify, Vercel, Cloudflare Pages...); Turnstile does not need
the domain on Cloudflare.

**Status:** extracted from mikehaslam.com (2026-09-16). Slot rules pass 30
checks, the modal flow was verified in stub mode, and a live booking passed:
guest invite, owner heads-up, Sheet row, calendar event, taken slot refused.

## Bundled files

| Path | What |
|---|---|
| `templates/apps-script/Code.gs` | Routes, booking, Sheet setup, heads-up email. Nothing client-specific: do not edit per project |
| `templates/apps-script/Slots.gs` | Pure slot rules (hours, gap, notice, days off, DST). Tested by `scripts/test-slots.js` |
| `templates/apps-script/appsscript.json` | Calendar advanced service, scopes, web app access. Set `timeZone` per client |
| `templates/site/booking.config.js` | The only site file with client values: endpoint, Turnstile site key, fallback email, legacy URL |
| `templates/site/bookingApi.js` | Framework-free client with the lost-reply retry, plus a stub client for local dev |
| `templates/site/bookingTime.js` | Framework-free time zone helpers and day grouping |
| `templates/site/turnstile.js` | `createTurnstile()`: load, token wait, reset |
| `templates/site/useBooking.js` | Vue composable: one shared `isOpen`, `openBooking()`, focus return |
| `templates/site/BookingModal.vue` | The modal. Themes through `--bk-*` custom properties at the top of its style block |
| `templates/owner-guide.html` | Plain-language guide to the Sheet and calendar for the owner |
| `scripts/test-slots.js` | `node test-slots.js [apps-script folder]`: 30 slot-rule checks |
| `references/click-paths.md` | Exact clicks for the owner (Apps Script, Turnstile) and the live test script |
| `references/gotchas.md` | Everything that tripped up the first build. Read before Phase 2 |

## How to run this with the user

- **One question at a time** in Phase 0, each with a recommended default.
- **End every phase with a checkpoint:** what was done, how it was verified,
  what is next. Wait for a go-ahead.
- **Claude does:** code, tests, commits, curl checks against the live script,
  and the Turnstile widget in its own Chrome tab group.
- **The owner does, with exact clicks from `click-paths.md`:** creating the
  Sheet, pasting the script, Google's permission screens, deploying, copying
  the Turnstile secret into Script Properties, and the live test booking.
  Claude never reads, enters or asks for a secret and never clicks a consent
  screen or a bot check.
- **Pushing to production needs permission every time.** It swaps the site's
  booking buttons over to the new modal.
- Keep copy free of em dashes; it is the user's standing rule.

## Phase 0: Interview

Skip anything already known from the project or earlier chat.

1. **Site.** Repo, framework, host, and every hostname the modal will run on.
   The modal is Vue; for another stack, plan to port its markup and CSS (the
   services and time helpers are framework-free).
2. **Google account.** Which account's calendar takes the bookings? Recommend
   a Google Workspace account on the business domain, so invites and Meet
   links come from that domain. The Sheet and script must live in that same
   account.
3. **The call.** Title, length, gap between calls, start-time step, weekly
   hours and time zone, minimum notice, how far ahead. Defaults: 30 minutes,
   30 minute gap, every 30 minutes, weekdays 9 to 5, 12 hours notice, 14 days.
4. **Instant or request?** Recommend instant booking (the template). If they
   want request-and-confirm, say it is a separate build and scope it first.
5. **Other calendars.** Should a personal calendar block time too? It needs
   free/busy shared with the booking account.
6. **Fallback email** shown if times fail to load, and the **booking tool
   being replaced** (its URL becomes the pre-launch fallback).
7. **Cloudflare account** for Turnstile, and which account inside it.
8. **Modal copy and brand.** Title, subtitle, photo, and the brand tokens that
   map onto `--bk-*`. Draft the copy in the brand's voice and get approval.

Checkpoint: the answers as a short table.

## Phase 1: Backend code

1. Copy `templates/apps-script/*` into the project (e.g. `booking/apps-script/`)
   and commit it with the site. Set `timeZone` in `appsscript.json`.
2. Run `node <skill>/scripts/test-slots.js <project>/booking/apps-script`.
   All checks must pass.
3. Copy `templates/owner-guide.html` into the project (e.g. `booking/`).

Checkpoint: test output.

## Phase 2: Sheet and Apps Script (owner, guided)

Read `references/gotchas.md` first. Hand the owner `click-paths.md` §1 one step
at a time: blank Sheet in the right account, Extensions > Apps Script, paste
three files, show the manifest, run `setup()` and approve, fill Settings, run
`previewSlots()`, deploy as web app, send the `/exec` URL.

Verify from the terminal once they send the URL:

```bash
URL='<web app url>'
curl -sL "$URL"                   # {"ok":true,"service":"booking"}
curl -sL "$URL?action=slots"      # {"ok":true,"timeZone":...,"slots":[...]}
```

`could not load times` means the script threw: have the owner run
`previewSlots` and read the log (gotchas 3 to 6).

Checkpoint: URL, slot count, first few times converted to the owner's zone.

## Phase 3: Turnstile

Claude creates the widget in its own Chrome tab (`click-paths.md` §2), reads
only the **site key**, and puts it in the site config. The owner copies the
**secret key** into Script Properties as `TURNSTILE_SECRET`. No redeploy is
needed for properties.

Checkpoint: widget name, hostnames, site key recorded.

## Phase 4: Website

1. Copy `templates/site/*`: config to `src/config/booking.js`, the services,
   the composable and the modal. Fix import paths for the project.
2. Map the `--bk-*` properties at the top of the modal's style block to the
   brand's tokens. Set title, subtitle and photo props.
3. Mount `<BookingModal />` once at the app root so every page can open it.
4. Switch every booking button to `openBooking` (use `<button type="button">`).
   Remove the old tool's links; keep its URL only as `LEGACY_BOOKING_URL`.
5. Test in stub mode (endpoint empty, `npm run dev`): every button opens it;
   pick, fill, confirm; `?bookingStub=taken` shows the "just got booked"
   notice; `?bookingStub=down` shows Try again; Esc, backdrop, Tab trap, focus
   return; 375px phone sheet with no sideways scroll. The preview pane's tab
   may be throttled (gotcha 12).
6. Put the real endpoint in the config. `npm run build`, then build a clean
   `git archive` export to catch ignored files (gotcha 11).

Checkpoint: stub-mode results, phone screenshot, clean build.

## Phase 5: Go live

Turnstile only accepts the hostnames on the widget, so the live test happens
on a listed domain. Get permission, commit, push, confirm the deploy is serving
the new bundle, then walk the owner through `click-paths.md` §3 and confirm
item by item: event with Meet link, guest invite, heads-up email, Bookings row,
same slot refused, Days off closes a date within a minute.

If something is off: missing `TURNSTILE_SECRET` (every booking says
verification failed), hostname not on the widget, or stale deployment (gotcha 2).

## Handoff

- Send the owner `owner-guide.html` and walk through moving and cancelling a
  call in Google Calendar.
- In the project's `booking/README.md`, keep a **live values** table: Sheet,
  owning Google account, script project, Web App URL, Turnstile widget and
  Cloudflare account, fallback email.
- Save a project memory with which account owns each piece.
- Close Claude's Chrome tabs.
- Offer, don't do: raise minimum notice, share a personal calendar's free/busy,
  lazy-load the modal to keep the main bundle lean.
