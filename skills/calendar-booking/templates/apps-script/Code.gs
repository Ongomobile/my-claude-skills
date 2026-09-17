/**
 * Booking backend: a branded calendar on top of Google Calendar.
 *
 *   GET  ?action=slots   open start times for the website
 *   POST {action:'book'} books one call: Google Calendar event with a Meet
 *                        link and the guest invited, a row on Bookings, and a
 *                        heads-up email to the owner
 *
 * This script is bound to a Google Sheet (Extensions > Apps Script). Run
 * setup() once to create the Settings, Hours, Days off and Bookings tabs.
 * Hours, gaps and days off are edited in the Sheet, never here.
 *
 * Script Properties (Project Settings > Script Properties):
 *   TURNSTILE_SECRET  Cloudflare Turnstile secret key (required)
 *   OWNER_EMAIL       where heads-ups go (optional, defaults to this account)
 *
 * Needs the Calendar advanced service (appsscript.json enables it).
 */

const TABS = {
  settings: 'Settings',
  hours: 'Hours',
  daysOff: 'Days off',
  bookings: 'Bookings',
}

// Settings tab labels, and what setup() writes the first time.
const SETTINGS = [
  { key: 'businessName', label: 'Business name', value: 'Your business name', note: 'Shown in the calendar event and the heads-up email.' },
  { key: 'meetingTitle', label: 'Meeting title', value: 'Free 30-minute call', note: 'The calendar event title.' },
  { key: 'timeZone', label: 'Time zone', value: 'America/Los_Angeles', note: 'Your hours are in this time zone. Visitors see times in their own.' },
  { key: 'callMinutes', label: 'Call length (minutes)', value: '30', note: '' },
  { key: 'gapMinutes', label: 'Gap between calls (minutes)', value: '30', note: 'Free time kept before and after every call and every busy event.' },
  { key: 'stepMinutes', label: 'Start times every (minutes)', value: '30', note: '30 offers 9:00, 9:30, 10:00...' },
  { key: 'noticeHours', label: 'Minimum notice (hours)', value: '12', note: 'Nobody can book sooner than this.' },
  { key: 'bookAheadDays', label: 'Book ahead (days)', value: '14', note: 'How far ahead people can book.' },
  { key: 'checkCalendars', label: 'Calendars to check', value: 'primary', note: 'Busy times on these block bookings. Separate calendar IDs with commas.' },
  { key: 'bookingCalendar', label: 'Calendar to book on', value: 'primary', note: 'Where new calls are added.' },
]

const HOURS_DEFAULT = [
  ['Monday', '9:00 AM', '5:00 PM'],
  ['Tuesday', '9:00 AM', '5:00 PM'],
  ['Wednesday', '9:00 AM', '5:00 PM'],
  ['Thursday', '9:00 AM', '5:00 PM'],
  ['Friday', '9:00 AM', '5:00 PM'],
  ['Saturday', '', ''],
  ['Sunday', '', ''],
]

const BOOKINGS_HEADER = [
  'Booked at', 'Name', 'Email', 'Call time', 'Their time zone',
  'Working on', 'Website', 'Meet link', 'Event link', 'Booking ID',
]

const SLOTS_CACHE_KEY = 'slots:v1'
const SLOTS_CACHE_SECONDS = 60          // edits in the Sheet show up within a minute
const BOOKED_CACHE_SECONDS = 6 * 3600   // how long a retried booking gets its first answer
const MAX_BOOKINGS_PER_HOUR = 20        // across the whole site
const LIMITS = { name: 80, email: 254, workingOn: 1000, website: 200, timeZone: 60 }

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

function doGet(e) {
  const params = (e && e.parameter) || {}
  if (params.action === 'slots') {
    try {
      return jsonOut(getSlotsPayload())
    } catch (err) {
      console.error('slots failed: ' + (err && err.stack || err))
      return jsonOut({ ok: false, error: 'could not load times' })
    }
  }
  // The site treats a reply with `service` as "Google lost the real reply"
  // and retries. Keep the key if you change this.
  return jsonOut({ ok: true, service: 'booking' })
}

/**
 * The site posts JSON with Content-Type text/plain, a "simple request", so the
 * browser skips the CORS preflight that Apps Script cannot answer.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return jsonOut({ ok: false, error: 'empty request' })
    if (e.postData.contents.length > 6000) return jsonOut({ ok: false, error: 'too large' })

    let data
    try {
      data = JSON.parse(e.postData.contents)
    } catch (err) {
      return jsonOut({ ok: false, error: 'bad request' })
    }
    if (data.action !== 'book') return jsonOut({ ok: false, error: 'unknown action' })
    return jsonOut(book(data))
  } catch (err) {
    console.error('book failed: ' + (err && err.stack || err))
    return jsonOut({ ok: false, error: 'something went wrong' })
  }
}

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

function getSlotsPayload() {
  const cache = CacheService.getScriptCache()
  const cached = cache.get(SLOTS_CACHE_KEY)
  if (cached) return JSON.parse(cached)

  const payload = computeSlots()
  cache.put(SLOTS_CACHE_KEY, JSON.stringify(payload), SLOTS_CACHE_SECONDS)
  return payload
}

function computeSlots() {
  const config = readConfig()
  const now = Date.now()
  const slots = buildSlots({
    settings: config.settings,
    hours: config.hours,
    daysOff: config.daysOff,
    busy: fetchBusy(config.settings, now),
    nowMs: now,
    offsetMinutes: tzOffsetMinutes,
  })
  return {
    ok: true,
    timeZone: config.settings.timeZone,
    callMinutes: config.settings.callMinutes,
    bookAheadDays: config.settings.bookAheadDays,
    slots: slots,
  }
}

/** Busy periods across the checked calendars, padded a day past the window. */
function fetchBusy(settings, now) {
  const ids = settings.checkCalendars
  const response = Calendar.Freebusy.query({
    timeMin: new Date(now - 86400000).toISOString(),
    timeMax: new Date(now + (settings.bookAheadDays + 1) * 86400000).toISOString(),
    items: ids.map(function (id) { return { id: id } }),
  })

  const busy = []
  ids.forEach(function (id) {
    const cal = response.calendars && response.calendars[id]
    if (!cal) return
    if (cal.errors && cal.errors.length) {
      // A calendar that cannot be read must not look free.
      throw new Error('Cannot read calendar "' + id + '": ' + JSON.stringify(cal.errors))
    }
    ;(cal.busy || []).forEach(function (b) {
      busy.push({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() })
    })
  })
  return busy
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

function book(data) {
  // Honeypot: bots fill every field. Answer as if it worked, write nothing.
  if (data.company) return { ok: true, start: String(data.start || '') }

  const fields = {
    name: clean(data.name, LIMITS.name),
    email: clean(data.email, LIMITS.email).toLowerCase(),
    workingOn: clean(data.workingOn, LIMITS.workingOn),
    website: clean(data.website, LIMITS.website),
    timeZone: clean(data.timeZone, LIMITS.timeZone),
  }
  const bookingId = String(data.bookingId || '')
  const startMs = new Date(String(data.start || '')).getTime()

  if (!fields.name) return { ok: false, error: 'name required' }
  if (!isValidEmail(fields.email)) return { ok: false, error: 'invalid email' }
  if (!/^[A-Za-z0-9-]{16,64}$/.test(bookingId)) return { ok: false, error: 'bad booking id' }
  if (!isFinite(startMs)) return { ok: false, error: 'bad start time' }

  // A retry after Google lost the reply gets the first answer back. Checked
  // before Turnstile, because the retry's token may already be spent.
  const cache = CacheService.getScriptCache()
  const bookedKey = 'booked:' + bookingId
  const previous = cache.get(bookedKey)
  if (previous) return JSON.parse(previous)

  if (!verifyTurnstile(String(data.turnstileToken || ''))) return { ok: false, error: 'verification failed' }
  if (!underHourlyLimit(cache)) return { ok: false, error: 'busy, try again shortly' }

  const lock = LockService.getScriptLock()
  if (!lock.tryLock(20000)) return { ok: false, error: 'busy, try again shortly' }

  let result
  let config
  try {
    const again = cache.get(bookedKey)
    if (again) return JSON.parse(again)

    // Re-check against the live calendar, never the cached list: the slot must
    // still be one we would offer right now.
    config = readConfig()
    const startIso = new Date(startMs).toISOString()
    const open = computeSlotsWith(config)
    if (open.indexOf(startIso) === -1) return { ok: false, error: 'taken' }

    const event = createEvent(config.settings, fields, startMs, bookingId)
    const callTime = Utilities.formatDate(new Date(startMs), config.settings.timeZone, "EEE MMM d, yyyy 'at' h:mm a z")

    ensureBookingsTab().appendRow([
      new Date(), fields.name, fields.email, callTime, fields.timeZone,
      fields.workingOn, fields.website, event.meetLink, event.htmlLink, bookingId,
    ].map(safeCell))

    result = { ok: true, start: startIso, meetLink: event.meetLink }
    cache.put(bookedKey, JSON.stringify(result), BOOKED_CACHE_SECONDS)
    cache.remove(SLOTS_CACHE_KEY)
    result.callTime = callTime
    result.htmlLink = event.htmlLink
  } finally {
    lock.releaseLock()
  }

  // The call is booked and the guest invited. A failed heads-up is logged,
  // not reported to the visitor.
  try {
    sendOwnerHeadsUp(config.settings, fields, result)
  } catch (err) {
    console.error('heads-up email failed: ' + err)
  }

  return { ok: true, start: result.start, meetLink: result.meetLink }
}

function computeSlotsWith(config) {
  const now = Date.now()
  return buildSlots({
    settings: config.settings,
    hours: config.hours,
    daysOff: config.daysOff,
    busy: fetchBusy(config.settings, now),
    nowMs: now,
    offsetMinutes: tzOffsetMinutes,
  })
}

function createEvent(settings, fields, startMs, bookingId) {
  const tz = settings.timeZone
  const lines = [
    'Name: ' + fields.name,
    'Email: ' + fields.email,
    fields.website ? 'Website: ' + fields.website : '',
    fields.timeZone ? 'Their time zone: ' + fields.timeZone : '',
    '',
    fields.workingOn ? 'What they are working on:\n' + fields.workingOn : '',
  ].filter(function (line, i) { return line || i === 4 })

  const created = Calendar.Events.insert({
    summary: settings.businessName + ' + ' + fields.name + ': ' + settings.meetingTitle,
    description: lines.join('\n'),
    start: { dateTime: new Date(startMs).toISOString(), timeZone: tz },
    end: { dateTime: new Date(startMs + settings.callMinutes * 60000).toISOString(), timeZone: tz },
    attendees: [{ email: fields.email, displayName: fields.name }],
    guestsCanModify: false,
    reminders: { useDefault: true },
    conferenceData: {
      createRequest: { requestId: bookingId, conferenceSolutionKey: { type: 'hangoutsMeet' } },
    },
    extendedProperties: { private: { bookingId: bookingId } },
  }, settings.bookingCalendar, { conferenceDataVersion: 1, sendUpdates: 'all' })

  const video = ((created.conferenceData && created.conferenceData.entryPoints) || [])
    .filter(function (p) { return p.entryPointType === 'video' })[0]
  return {
    meetLink: created.hangoutLink || (video && video.uri) || '',
    htmlLink: created.htmlLink || '',
  }
}

function sendOwnerHeadsUp(settings, fields, result) {
  const to = PropertiesService.getScriptProperties().getProperty('OWNER_EMAIL') ||
    Session.getEffectiveUser().getEmail()
  if (!to) return

  const rows = [
    ['When', result.callTime],
    ['Name', fields.name],
    ['Email', fields.email],
    ['Website', fields.website],
    ['Their time zone', fields.timeZone],
    ['Working on', fields.workingOn],
  ].filter(function (r) { return r[1] })

  const html =
    '<div style="font:15px/1.55 -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif">' +
    '<p><strong>' + escapeHtml(fields.name) + '</strong> booked a call.</p>' +
    '<table style="border-collapse:collapse">' +
    rows.map(function (r) {
      return '<tr><td style="padding:4px 14px 4px 0;color:#6B6259;vertical-align:top">' + escapeHtml(r[0]) +
        '</td><td style="padding:4px 0;white-space:pre-wrap">' + escapeHtml(r[1]) + '</td></tr>'
    }).join('') +
    '</table>' +
    (result.meetLink ? '<p><a href="' + escapeHtml(result.meetLink) + '">Google Meet link</a></p>' : '') +
    (result.htmlLink ? '<p><a href="' + escapeHtml(result.htmlLink) + '">Open the event</a></p>' : '') +
    '<p style="color:#6B6259">The invite already went to them. Reply to this email to reach them.</p>' +
    '</div>'

  MailApp.sendEmail({
    to: to,
    replyTo: fields.email,
    name: settings.businessName,
    subject: 'New call booked: ' + fields.name + ', ' + result.callTime,
    htmlBody: html,
    body: rows.map(function (r) { return r[0] + ': ' + r[1] }).join('\n') +
      (result.meetLink ? '\nMeet: ' + result.meetLink : ''),
  })
}

// ---------------------------------------------------------------------------
// The Sheet
// ---------------------------------------------------------------------------

/**
 * Run once from the editor (select setup, click Run). Creates any missing tab
 * with defaults. Safe to run again: existing tabs are left alone.
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()

  makeTab(ss, TABS.settings, ['Setting', 'Value', 'What it does'], SETTINGS.map(function (s) {
    return [s.label, s.value, s.note]
  }), function (sheet) {
    sheet.getRange('B:B').setNumberFormat('@')
    sheet.setColumnWidth(1, 220)
    sheet.setColumnWidth(2, 220)
    sheet.setColumnWidth(3, 460)
  })

  makeTab(ss, TABS.hours, ['Day', 'Start', 'End'], HOURS_DEFAULT, function (sheet) {
    sheet.getRange('B:C').setNumberFormat('@')
    sheet.setColumnWidth(1, 140)
    sheet.getRange(HOURS_DEFAULT.length + 3, 1).setValue(
      'Blank start and end means closed. Add a second row for the same day to split it, e.g. 9:00 AM to 12:00 PM and 1:00 PM to 5:00 PM.')
  })

  makeTab(ss, TABS.daysOff, ['Date', 'Note'], [], function (sheet) {
    sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd')
    sheet.setColumnWidth(1, 140)
    sheet.setColumnWidth(2, 320)
  })

  ensureBookingsTab()
  console.log('Setup done. Fill in Business name on the Settings tab, then deploy as a web app.')
}

/** Run from the editor to see the next open times in the log. */
function previewSlots() {
  const payload = computeSlots()
  console.log(payload.slots.length + ' open times. Next ten, in ' + payload.timeZone + ':')
  payload.slots.slice(0, 10).forEach(function (iso) {
    console.log(Utilities.formatDate(new Date(iso), payload.timeZone, 'EEE MMM d, h:mm a'))
  })
}

function makeTab(ss, name, header, rows, format) {
  if (ss.getSheetByName(name)) return
  const sheet = ss.insertSheet(name)
  format(sheet)
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold')
  sheet.setFrozenRows(1)
  if (rows.length) sheet.getRange(2, 1, rows.length, header.length).setValues(rows)
}

function ensureBookingsTab() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  let sheet = ss.getSheetByName(TABS.bookings)
  if (!sheet) {
    sheet = ss.insertSheet(TABS.bookings)
    sheet.getRange(1, 1, 1, BOOKINGS_HEADER.length).setValues([BOOKINGS_HEADER]).setFontWeight('bold')
    sheet.setFrozenRows(1)
  }
  return sheet
}

/** Settings, Hours and Days off, read as displayed so times stay text. */
function readConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const tab = function (name) {
    const sheet = ss.getSheetByName(name)
    if (!sheet) throw new Error('Missing tab "' + name + '". Run setup() first.')
    return sheet.getDataRange().getDisplayValues().slice(1)
  }

  const byLabel = {}
  tab(TABS.settings).forEach(function (row) {
    byLabel[String(row[0]).trim().toLowerCase()] = String(row[1]).trim()
  })
  const raw = {}
  SETTINGS.forEach(function (s) {
    const value = byLabel[s.label.toLowerCase()]
    raw[s.key] = value === undefined || value === '' ? s.value : value
  })

  const settings = {
    businessName: raw.businessName,
    meetingTitle: raw.meetingTitle,
    timeZone: raw.timeZone,
    callMinutes: positiveInt(raw.callMinutes, 30),
    gapMinutes: nonNegativeInt(raw.gapMinutes, 30),
    stepMinutes: positiveInt(raw.stepMinutes, 30),
    noticeHours: nonNegativeInt(raw.noticeHours, 12),
    bookAheadDays: Math.min(positiveInt(raw.bookAheadDays, 14), 60),
    checkCalendars: raw.checkCalendars.split(',').map(function (s) { return s.trim() }).filter(Boolean),
    bookingCalendar: raw.bookingCalendar,
  }
  if (settings.checkCalendars.indexOf(settings.bookingCalendar) === -1) {
    settings.checkCalendars.push(settings.bookingCalendar)
  }

  return {
    settings: settings,
    hours: parseHours(tab(TABS.hours)),
    daysOff: tab(TABS.daysOff).map(function (row) { return parseDateKey(row[0]) }).filter(Boolean),
  }
}

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

/** Minutes east of UTC for a time zone at a moment, e.g. -420 for PDT. */
function tzOffsetMinutes(ms, tz) {
  const z = Utilities.formatDate(new Date(ms), tz, 'Z') // "-0700"
  const sign = z.charAt(0) === '-' ? -1 : 1
  return sign * (parseInt(z.slice(1, 3), 10) * 60 + parseInt(z.slice(3, 5), 10))
}

/** Cloudflare Turnstile. The secret lives in Script Properties only. */
function verifyTurnstile(token) {
  const secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET')
  if (!secret) {
    console.error('TURNSTILE_SECRET is not set in Script Properties')
    return false
  }
  if (!token || token.length > 2048) return false
  try {
    const response = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'post',
      payload: { secret: secret, response: token },
      muteHttpExceptions: true,
    })
    return JSON.parse(response.getContentText()).success === true
  } catch (err) {
    console.error('Turnstile verify failed: ' + err)
    return false
  }
}

function underHourlyLimit(cache) {
  const key = 'rate:' + Math.floor(Date.now() / 3600000)
  const count = parseInt(cache.get(key) || '0', 10)
  if (count >= MAX_BOOKINGS_PER_HOUR) return false
  cache.put(key, String(count + 1), 3600)
  return true
}

function clean(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max)
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
}

/** Stops a visitor's "=IMPORTXML(...)" from running as a formula in the Sheet. */
function safeCell(value) {
  return typeof value === 'string' && /^[=+\-@]/.test(value) ? "'" + value : value
}

function positiveInt(value, fallback) {
  const n = parseInt(value, 10)
  return n > 0 ? n : fallback
}

function nonNegativeInt(value, fallback) {
  const n = parseInt(value, 10)
  return n >= 0 ? n : fallback
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
