/**
 * Slots: which times can be booked.
 *
 * Everything in this file is plain JavaScript with no Apps Script services,
 * so booking/test-slots.js can run it in Node. Time zone math goes through an
 * offsetMinutes(ms, timeZone) function that the caller passes in: Code.gs uses
 * Utilities.formatDate, the test uses Intl. Both handle daylight saving.
 */

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/**
 * The open start times, as ISO strings in UTC, sorted.
 *
 * @param {object} args
 * @param {object} args.settings  timeZone, callMinutes, gapMinutes, stepMinutes,
 *                                noticeHours, bookAheadDays
 * @param {Object<number, Array<{start:number,end:number}>>} args.hours
 *        Weekday (0 = Sunday) to open windows, in minutes after midnight.
 * @param {string[]} args.daysOff  'YYYY-MM-DD' dates in the business time zone
 * @param {Array<{start:number,end:number}>} args.busy  busy periods, epoch ms
 * @param {number} args.nowMs
 * @param {function(number, string): number} args.offsetMinutes
 */
function buildSlots(args) {
  const s = args.settings
  const tz = s.timeZone
  const callMs = s.callMinutes * 60000
  const gapMs = s.gapMinutes * 60000
  const earliest = args.nowMs + s.noticeHours * 3600000
  const offDays = {}
  ;(args.daysOff || []).forEach(function (key) { offDays[key] = true })

  // Today's date where the business is, not where the server is.
  const localNow = new Date(args.nowMs + args.offsetMinutes(args.nowMs, tz) * 60000)
  const y = localNow.getUTCFullYear()
  const m = localNow.getUTCMonth()
  const d = localNow.getUTCDate()

  const slots = []
  for (let i = 0; i < s.bookAheadDays; i++) {
    const day = new Date(Date.UTC(y, m, d + i))
    const key = dateKey(day)
    if (offDays[key]) continue

    const windows = args.hours[day.getUTCDay()] || []
    windows.forEach(function (w) {
      for (let t = w.start; t + s.callMinutes <= w.end; t += s.stepMinutes) {
        const start = zonedToUtc(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(),
          Math.floor(t / 60), t % 60, tz, args.offsetMinutes)
        const end = start + callMs
        if (start < earliest) continue
        // The gap pads every busy period on both sides, so calls never sit
        // back to back with a meeting or with each other.
        const clash = args.busy.some(function (b) {
          return start < b.end + gapMs && end > b.start - gapMs
        })
        if (!clash) slots.push(start)
      }
    })
  }

  return slots
    .sort(function (a, b) { return a - b })
    .filter(function (v, idx, arr) { return idx === 0 || v !== arr[idx - 1] })
    .map(function (ms) { return new Date(ms).toISOString() })
}

/** Wall-clock time in a time zone to epoch ms. Month is 0-based. */
function zonedToUtc(year, month, day, hour, minute, tz, offsetMinutes) {
  const guess = Date.UTC(year, month, day, hour, minute)
  const first = offsetMinutes(guess, tz)
  const ms = guess - first * 60000
  // Near a daylight saving change the first guess can land on the wrong side.
  const second = offsetMinutes(ms, tz)
  return second === first ? ms : guess - second * 60000
}

function dateKey(date) {
  return date.getUTCFullYear() + '-' + pad2(date.getUTCMonth() + 1) + '-' + pad2(date.getUTCDate())
}

function pad2(n) {
  return (n < 10 ? '0' : '') + n
}

/**
 * "9:00", "09:30", "17:00", "9:00 AM", "5:30 pm", "9 am", "9:00:00" to minutes
 * after midnight. Anything else is null.
 */
function parseClock(value) {
  const text = String(value == null ? '' : value).trim().toLowerCase()
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?$/)
  if (!match) return null
  let hour = parseInt(match[1], 10)
  const minute = match[2] ? parseInt(match[2], 10) : 0
  const meridiem = match[3] ? match[3].charAt(0) : ''
  if (minute > 59) return null
  if (meridiem) {
    if (hour < 1 || hour > 12) return null
    if (hour === 12) hour = 0
    if (meridiem === 'p') hour += 12
  } else if (hour > 24) {
    return null
  }
  const total = hour * 60 + minute
  return total <= 24 * 60 ? total : null
}

/**
 * Rows of [Day, Start, End] to { weekday: [{start, end}] }. Blank or
 * unreadable rows are skipped, so a blank Saturday means closed. A day can
 * have more than one row (9 to 12, then 1 to 5).
 */
function parseHours(rows) {
  const hours = {}
  rows.forEach(function (row) {
    const name = String(row[0] || '').trim().toLowerCase()
    const weekday = DAY_NAMES.findIndex(function (d) { return name && d.indexOf(name.slice(0, 3)) === 0 })
    const start = parseClock(row[1])
    const end = parseClock(row[2])
    if (weekday < 0 || start === null || end === null || end <= start) return
    ;(hours[weekday] = hours[weekday] || []).push({ start: start, end: end })
  })
  return hours
}

/** "2026-10-05" or "10/5/2026" to "2026-10-05". Anything else is null. */
function parseDateKey(value) {
  const text = String(value == null ? '' : value).trim()
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (match) return match[1] + '-' + pad2(+match[2]) + '-' + pad2(+match[3])
  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) return match[3] + '-' + pad2(+match[1]) + '-' + pad2(+match[2])
  return null
}
