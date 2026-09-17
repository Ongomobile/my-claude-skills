/**
 * Broadcasts: one-off emails to everyone on the list, written in the Sheet.
 *
 * The owners never touch code. In the Broadcasts tab they write a Subject and
 * a Message, then pick a Status:
 *
 *   draft   nothing happens. Work on it as long as you like.
 *   test    one copy goes to BROADCASTS.testTo within seconds, then "tested".
 *   send    it goes to every active subscriber, then "sending", then "sent".
 *
 * The script sets tested, sending, sent and error itself, and explains what it
 * is doing in the Progress column. Setting a send back to draft stops it;
 * setting it to send again carries on where it stopped.
 *
 * Sending is paced. Resend's free plan allows 100 emails a day for the whole
 * account, and the guide emails and owner notices need some of that, so no
 * more than BROADCASTS.dailyLimit list emails go out per day, and only between
 * sendFromHour and sendUntilHour. A big list simply takes a few days.
 *
 * Every email is written to the Broadcast log tab as it goes. That log is how
 * a run that stops halfway knows where to pick up, so nobody gets the same
 * broadcast twice. Do not delete rows from it while a send is in progress.
 *
 * Two triggers drive it, both created by setupBroadcasts():
 *   onBroadcastEdit  fires on any edit to the Sheet, so a test or a send
 *                    starts within seconds of picking the Status
 *   runBroadcasts    hourly, to carry a paced send on to the next day
 *
 * Run setupBroadcasts once from the editor, signed in as the Sheet owner. It
 * makes both tabs and both triggers, and is safe to run again.
 */

// Columns in the Broadcasts tab, zero based. Change BROADCAST_HEADERS too.
const BCOL = {
  status: 0,
  subject: 1,
  message: 2,
  buttonText: 3,
  buttonLink: 4,
  progress: 5,
  id: 6,
}

const BROADCAST_HEADERS = [
  'Status', 'Subject', 'Message', 'Button text', 'Button link', 'Progress', 'Id (leave blank)',
]

// Columns in the Broadcast log tab, zero based.
const LCOL = { sentAt: 0, id: 1, subject: 2, email: 3, result: 4 }
const BROADCAST_LOG_HEADERS = ['Sent at', 'Broadcast id', 'Subject', 'Email', 'Result']

// The Status dropdown. Owners pick the first three; the script sets the rest.
const BROADCAST_STATUSES = ['draft', 'test', 'send', 'tested', 'sending', 'sent', 'error']

// Resend allows 2 requests a second for the whole account, and a signup that
// arrives mid-run needs two of its own. One a second leaves them room.
const BROADCAST_PAUSE_MS = 1000

// Apps Script kills any run at 6 minutes. Stop well before that, cleanly.
const BROADCAST_RUN_BUDGET_MS = 4.5 * 60 * 1000

// ---------------------------------------------------------------------------
// Setup, run once
// ---------------------------------------------------------------------------

function setupBroadcasts() {
  const book = SpreadsheetApp.openById(CONFIG.sheetId)

  const isNew = !book.getSheetByName(BROADCASTS.sheetName)
  const tab = ensureTab(book, BROADCASTS.sheetName, BROADCAST_HEADERS)
  ensureTab(book, BROADCASTS.logSheetName, BROADCAST_LOG_HEADERS)

  if (isNew) {
    tab.appendRow([
      'draft',
      'Example: fresh this week',
      'Write your message here. Leave a blank line between paragraphs.\n\n' +
        'The greeting ("Hi Jane,") and the unsubscribe footer are added for you.',
      '',
      '',
      'Change Status to test to get a copy in your inbox.',
      '',
    ])
  }

  const rows = Math.max(1, tab.getMaxRows() - 1)
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(BROADCAST_STATUSES, true)
    .setAllowInvalid(false)
    .build()
  tab.getRange(2, BCOL.status + 1, rows, 1).setDataValidation(statusRule)
  tab.getRange(2, BCOL.message + 1, rows, 1).setWrap(true)
  tab.setColumnWidth(BCOL.subject + 1, 260)
  tab.setColumnWidth(BCOL.message + 1, 420)
  tab.setColumnWidth(BCOL.progress + 1, 320)

  ScriptApp.getProjectTriggers().forEach(function (t) {
    const handler = t.getHandlerFunction()
    if (handler === 'runBroadcasts' || handler === 'onBroadcastEdit') ScriptApp.deleteTrigger(t)
  })
  ScriptApp.newTrigger('runBroadcasts').timeBased().everyHours(1).create()
  ScriptApp.newTrigger('onBroadcastEdit').forSpreadsheet(CONFIG.sheetId).onEdit().create()

  console.log('Broadcasts ready: tabs made, hourly and on-edit triggers installed.')
}

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------

/**
 * Fires on every edit anywhere in the Sheet, by anyone with edit access, and
 * runs as whoever ran setupBroadcasts. Returns at once unless the edit touched
 * the Status column of the Broadcasts tab.
 */
function onBroadcastEdit(e) {
  if (!e || !e.range) return
  const range = e.range
  if (range.getSheet().getName() !== BROADCASTS.sheetName) return
  const statusColumn = BCOL.status + 1
  if (range.getColumn() > statusColumn || range.getLastColumn() < statusColumn) return
  runBroadcasts()
}

function runBroadcasts() {
  const started = Date.now()
  const book = SpreadsheetApp.openById(CONFIG.sheetId)
  const tab = book.getSheetByName(BROADCASTS.sheetName)
  if (!tab) return

  // Most runs find nothing to do. Find that out before taking the run flag.
  const pending = tab.getDataRange().getValues().some(function (row, i) {
    return i > 0 && ['test', 'send', 'sending'].indexOf(normalStatus(row[BCOL.status])) !== -1
  })
  if (!pending) return

  if (!claimBroadcastRun()) return
  try {
    const log = ensureTab(book, BROADCASTS.logSheetName, BROADCAST_LOG_HEADERS)
    const rows = tab.getDataRange().getValues()

    // Tests first: one inbox, no pacing, and the owner is waiting on it.
    for (let i = 1; i < rows.length; i++) {
      if (normalStatus(rows[i][BCOL.status]) === 'test') runBroadcastTest(tab, i + 1, rows[i])
    }

    for (let i = 1; i < rows.length; i++) {
      const status = normalStatus(rows[i][BCOL.status])
      if (status !== 'send' && status !== 'sending') continue
      // One broadcast at a time. The next starts only once this one is done.
      if (!runBroadcastSend(tab, log, i + 1, rows[i], started)) break
    }
  } finally {
    PropertiesService.getScriptProperties().deleteProperty('BROADCAST_RUNNING')
  }
}

/**
 * Two runs at once would send the same people the same email, and the edit
 * trigger and the hourly one can overlap. So a run holds a flag in Script
 * Properties while it works. The script lock only guards reading and setting
 * the flag: held for a whole run it would stall signups, which give up on the
 * lock after 20 seconds.
 */
function claimBroadcastRun() {
  const lock = LockService.getScriptLock()
  if (!lock.tryLock(5000)) return false
  try {
    const props = PropertiesService.getScriptProperties()
    const since = Number(props.getProperty('BROADCAST_RUNNING') || 0)
    // A run that crashed never clears its flag. Past Apps Script's 6 minute
    // limit it cannot still be going.
    if (since && Date.now() - since < 7 * 60 * 1000) return false
    props.setProperty('BROADCAST_RUNNING', String(Date.now()))
    return true
  } finally {
    lock.releaseLock()
  }
}

// ---------------------------------------------------------------------------
// Test and send
// ---------------------------------------------------------------------------

function runBroadcastTest(tab, rowNumber, row) {
  const problem = broadcastProblem(row)
  if (problem) return setBroadcastState(tab, rowNumber, 'error', problem)

  try {
    sendBroadcastEmail({
      email: BROADCASTS.testTo,
      firstName: '',
      token: '',
      broadcast: readBroadcast(row),
      test: true,
    })
  } catch (err) {
    console.error('broadcast test failed for row ' + rowNumber + ': ' + err)
    return setBroadcastState(tab, rowNumber, 'error', 'The test did not send: ' + shortError(err))
  }

  setBroadcastState(tab, rowNumber, 'tested',
    'Test sent to ' + BROADCASTS.testTo + ', ' + broadcastTime(new Date()) +
    '. Change Status to send when it looks right.')
}

/**
 * Sends one broadcast as far as today's allowance, the sending hours, and the
 * run's time budget allow. Returns true only when it finished, so the caller
 * knows whether the next broadcast may start.
 */
function runBroadcastSend(tab, log, rowNumber, row, started) {
  const problem = broadcastProblem(row)
  if (problem) {
    setBroadcastState(tab, rowNumber, 'error', problem)
    return true
  }

  let id = String(row[BCOL.id]).trim()
  if (!id) {
    id = makeToken().slice(0, 12)
    tab.getRange(rowNumber, BCOL.id + 1).setValue(id)
  }
  const broadcast = readBroadcast(row)

  // What the log already says: who has had this one, and how many list emails
  // went out today across every broadcast.
  const today = dayKey(new Date())
  const handled = {}
  let sent = 0
  let failed = 0
  let sentToday = 0
  log.getDataRange().getValues().forEach(function (r, i) {
    if (i === 0) return
    const ok = String(r[LCOL.result]) === 'sent'
    if (String(r[LCOL.id]) === id) {
      handled[String(r[LCOL.email]).toLowerCase()] = true
      if (ok) sent++
      else failed++
    }
    if (ok && r[LCOL.sentAt] instanceof Date && dayKey(r[LCOL.sentAt]) === today) sentToday++
  })

  const waiting = activeSubscribers().filter(function (p) { return !handled[p.email] })
  const total = function () { return sent + failed + waiting.length }

  if (!waiting.length) {
    setBroadcastState(tab, rowNumber, 'sent', finishedLine(sent, failed))
    return true
  }

  const hour = Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'H'))
  if (hour < BROADCASTS.sendFromHour || hour >= BROADCASTS.sendUntilHour) {
    setBroadcastState(tab, rowNumber, 'sending',
      progressLine(sent, total()) + ' Waiting for sending hours, ' +
      hourLabel(BROADCASTS.sendFromHour) + ' to ' + hourLabel(BROADCASTS.sendUntilHour) + '.')
    return false
  }

  let allowance = BROADCASTS.dailyLimit - sentToday
  if (allowance <= 0) {
    setBroadcastState(tab, rowNumber, 'sending', progressLine(sent, total()) + ' ' + dailyLimitLine())
    return false
  }

  setBroadcastState(tab, rowNumber, 'sending', progressLine(sent, total()) + ' Sending now.')

  const totalAtStart = total()
  let stopReason = ''
  let done = 0

  for (let i = 0; i < waiting.length; i++) {
    if (allowance <= 0) {
      stopReason = dailyLimitLine()
      break
    }
    if (Date.now() - started > BROADCAST_RUN_BUDGET_MS) {
      stopReason = 'Carries on within the hour.'
      break
    }

    const person = waiting[i]
    let result = 'sent'
    try {
      sendBroadcastEmail({
        email: person.email,
        firstName: person.firstName,
        token: person.token,
        broadcast: broadcast,
      })
    } catch (err) {
      // An address Resend rejects will be rejected every time, so log it and
      // move on. Anything else (a limit, an outage, a revoked key) is not this
      // person's fault: stop, and let the next run try them again.
      if (/"statusCode":\s*422|validation_error|Invalid email/i.test(String(err))) {
        result = 'failed: ' + shortError(err)
      } else {
        console.error('broadcast ' + id + ' paused: ' + err)
        stopReason = 'Paused: ' + shortError(err) + ' Tries again within the hour.'
        break
      }
    }

    log.appendRow([new Date(), id, sanitizeCell(broadcast.subject), sanitizeCell(person.email), result])
    done++
    if (result === 'sent') {
      sent++
      allowance--
    } else {
      failed++
    }

    if (i < waiting.length - 1) Utilities.sleep(BROADCAST_PAUSE_MS)
  }

  if (done === waiting.length) {
    setBroadcastState(tab, rowNumber, 'sent', finishedLine(sent, failed))
    return true
  }

  setBroadcastState(tab, rowNumber, 'sending', progressLine(sent, totalAtStart) + ' ' + stopReason)
  return false
}

/**
 * Everyone who should get list email, once each, in signup order. A person
 * can have a row per offer; if any of their rows is anything but active, they
 * get nothing. Unsubscribing from one signup means no list email at all.
 */
function activeSubscribers() {
  const values = ensureSheet().getDataRange().getValues()
  const people = {}
  const order = []
  const blocked = {}

  for (let i = 1; i < values.length; i++) {
    const r = values[i]
    const email = String(r[COL.email]).trim().toLowerCase()
    if (!isValidEmail(email)) continue
    if (String(r[COL.status]) !== 'active') {
      blocked[email] = true
      continue
    }
    if (!people[email]) {
      people[email] = { email: email, firstName: String(r[COL.firstName]), token: String(r[COL.token]) }
      order.push(email)
    }
  }

  return order
    .filter(function (email) { return !blocked[email] })
    .map(function (email) { return people[email] })
}

// ---------------------------------------------------------------------------
// The message
// ---------------------------------------------------------------------------

/**
 * The list email. Owner text is plain: a blank line starts a new paragraph,
 * a single line break stays a line break, and everything is escaped.
 */
function sendBroadcastEmail(args) {
  const b = args.broadcast
  const name = args.firstName ? escapeHtml(args.firstName) : 'there'
  const unsubscribeUrl = unsubscribePageLink(args.token)

  const paragraphs = b.message
    .split(/\n\s*\n/)
    .map(function (p) { return p.trim() })
    .filter(Boolean)
    .map(function (p) { return '<p>' + escapeHtml(p).replace(/\n/g, '<br>') + '</p>' })
    .join('')

  const body =
    '<p>Hi ' + name + ',</p>' + paragraphs +
    (b.buttonLink ? buttonHtml(escapeHtml(b.buttonLink), b.buttonText) : '')

  sendMail({
    to: args.email,
    subject: (args.test ? '[Test] ' : '') + b.subject,
    html: wrap(body, unsubscribeUrl),
    text: stripTags(body) +
          (b.buttonLink ? '\n\n' + b.buttonText + ': ' + b.buttonLink : '') +
          '\n\n' + CONFIG.postalAddress + '\nUnsubscribe: ' + unsubscribeUrl,
    // Empty for a test, which leaves out the one-click header: the owner is
    // not on the list, so there is nothing for it to unsubscribe.
    unsubscribeToken: args.token,
  })
}

function readBroadcast(row) {
  return {
    subject: String(row[BCOL.subject]).trim(),
    message: String(row[BCOL.message]).replace(/\r\n?/g, '\n').trim(),
    buttonText: String(row[BCOL.buttonText]).trim(),
    buttonLink: String(row[BCOL.buttonLink]).trim(),
  }
}

/** Plain-English reason a row cannot go out yet, or '' when it is fine. */
function broadcastProblem(row) {
  const b = readBroadcast(row)
  if (!b.subject || !b.message) return 'Needs a Subject and a Message.'
  if (Boolean(b.buttonText) !== Boolean(b.buttonLink)) {
    return 'Button text and Button link go together. Fill in both, or neither.'
  }
  if (b.buttonLink && !/^https?:\/\/[^\s"'<>]+$/.test(b.buttonLink)) {
    return 'Button link must be a full web address starting with https://'
  }
  return ''
}

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

function ensureTab(book, name, headers) {
  let tab = book.getSheetByName(name)
  if (!tab) tab = book.insertSheet(name)
  if (tab.getLastRow() === 0) {
    tab.appendRow(headers)
    tab.setFrozenRows(1)
  }
  return tab
}

function setBroadcastState(tab, rowNumber, status, progress) {
  tab.getRange(rowNumber, BCOL.status + 1).setValue(status)
  tab.getRange(rowNumber, BCOL.progress + 1).setValue(progress)
}

function normalStatus(value) {
  return String(value).trim().toLowerCase()
}

function progressLine(sent, total) {
  return sent + ' of ' + total + ' sent.'
}

function finishedLine(sent, failed) {
  return 'Sent to ' + sent + (sent === 1 ? ' person' : ' people') +
    (failed ? ', ' + failed + ' address' + (failed === 1 ? '' : 'es') + ' failed (see Broadcast log)' : '') +
    '. Finished ' + broadcastTime(new Date()) + '.'
}

function dailyLimitLine() {
  return 'Daily limit of ' + BROADCASTS.dailyLimit + ' reached. The rest go out tomorrow from ' +
    hourLabel(BROADCASTS.sendFromHour) + '.'
}

function hourLabel(hour) {
  const h = Number(hour) % 24
  return (h % 12 || 12) + (h < 12 ? 'am' : 'pm')
}

function broadcastTime(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'MMM d, h:mm a')
}

function dayKey(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd')
}

/** Resend's own message when there is one, so the owners see why, not JSON. */
function shortError(err) {
  const text = String((err && err.message) || err)
  const match = text.match(/"message"\s*:\s*"([^"]+)"/)
  return (match ? match[1] : text.replace(/^Error:\s*/, '')).slice(0, 160)
}
