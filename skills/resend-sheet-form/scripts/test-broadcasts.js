#!/usr/bin/env node
/**
 * Runs Broadcasts.gs in Node against fake Google services: setup, tests,
 * validation, the edit trigger, sending hours, the daily limit, carrying a
 * send over to the next day, unsubscribes mid-send, rejected addresses, Resend
 * outages, and the overlap guard. Nothing is sent anywhere.
 *
 *   node test-broadcasts.js <folder with Config.gs, Code.gs, Emails.gs, Broadcasts.gs>
 *
 * Works on any install of this kit, including ones with older OFFERS shapes,
 * because it only drives the broadcast code. Exit code 0 means every check passed.
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const crypto = require('crypto')

const dir = process.argv[2]
if (!dir) {
  console.error('Usage: node test-broadcasts.js <apps-script folder>')
  process.exit(2)
}
const read = (name) => fs.readFileSync(path.join(dir, name), 'utf8')
const source = ['Config.gs', 'Code.gs', 'Emails.gs', 'Broadcasts.gs'].map(read).join('\n')

let failures = 0
const ok = (name, cond, detail) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !detail ? '' : '  -> ' + detail))
  if (!cond) failures++
}

// --- Fake Google -----------------------------------------------------------
function makeTab(name) {
  const tab = {
    name,
    rows: [],
    maxRows: 1000,
    validation: null,
    getName: () => name,
    getLastRow: () => tab.rows.length,
    getMaxRows: () => tab.maxRows,
    appendRow: (r) => tab.rows.push([...r]),
    setFrozenRows() {},
    setColumnWidth() {},
    getDataRange: () => ({ getValues: () => tab.rows.map((r) => [...r]) }),
    getRange: (r, c) => ({
      setValue: (v) => {
        while (tab.rows.length < r) tab.rows.push([])
        tab.rows[r - 1][c - 1] = v
      },
      setDataValidation: (rule) => { tab.validation = rule },
      setWrap() {},
    }),
  }
  return tab
}

let tabs = {}
let sent = []
let triggers = []
let props = {}
let resendMode = 'ok'          // 'ok' | 'quota' | 'down'
let rejectAddress = ''
let fakeHour = 10
let now = Date.parse('2026-09-17T14:00:00Z')

const RealDate = Date
class FakeDate extends RealDate {
  constructor(...a) { super(...(a.length ? a : [now])) }
  static now() { return now }
}

const book = {
  getSheetByName: (n) => tabs[n] || null,
  insertSheet: (n) => (tabs[n] = makeTab(n)),
}

const ctx = {
  Date: FakeDate,
  console: { log() {}, error() {} },
  SpreadsheetApp: {
    openById: () => book,
    newDataValidation: () => {
      const rule = {}
      const b = {
        requireValueInList: (list) => { rule.list = list; return b },
        setAllowInvalid: (v) => { rule.allowInvalid = v; return b },
        build: () => rule,
      }
      return b
    },
  },
  ScriptApp: {
    getProjectTriggers: () => triggers.map((t) => ({ getHandlerFunction: () => t.handler, _t: t })),
    deleteTrigger: (t) => { triggers = triggers.filter((x) => x !== t._t) },
    newTrigger: (handler) => {
      const t = { handler }
      const b = {
        timeBased: () => { t.kind = 'time'; return b },
        everyHours: (h) => { t.everyHours = h; return b },
        forSpreadsheet: (id) => { t.kind = 'sheet'; t.sheetId = id; return b },
        onEdit: () => { t.event = 'edit'; return b },
        create: () => { triggers.push(t); return t },
      }
      return b
    },
  },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ get() {}, put() {} }) },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (k) => ({ RESEND_API_KEY: 'key', RESEND_FROM: 'Test <hello@mail.example.com>', ...props })[k],
      setProperty: (k, v) => { props[k] = v },
      deleteProperty: (k) => { delete props[k] },
    }),
  },
  UrlFetchApp: {
    fetch: (url, o) => {
      const p = JSON.parse(o.payload)
      if (resendMode === 'down') throw new Error('Exception: Address unavailable: https://api.resend.com/emails')
      if (resendMode === 'quota') {
        return { getResponseCode: () => 429, getContentText: () => '{"statusCode":429,"message":"You have reached your daily email sending quota.","name":"daily_quota_exceeded"}' }
      }
      if (p.to[0] === rejectAddress) {
        return { getResponseCode: () => 422, getContentText: () => '{"statusCode":422,"message":"Invalid `to` field.","name":"validation_error"}' }
      }
      sent.push(p)
      return { getResponseCode: () => 200, getContentText: () => '{}' }
    },
  },
  MailApp: { sendEmail: (m) => sent.push(m), getRemainingDailyQuota: () => 100 },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    sleep() {},
    formatDate: (d, tz, pattern) => {
      if (pattern === 'H') return String(fakeHour)
      if (pattern === 'yyyy-MM-dd') return new RealDate(d.getTime()).toISOString().slice(0, 10)
      return 'Sep 17, 10:00 AM'
    },
  },
  Session: { getScriptTimeZone: () => 'America/New_York' },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => ({ body: JSON.parse(t) }) }) },
  HtmlService: { XFrameOptionsMode: { DENY: 1 }, createHtmlOutput: (h) => ({ setXFrameOptionsMode: () => ({ html: h }) }) },
}
vm.createContext(ctx)
vm.runInContext(source, ctx)
const run = (code) => vm.runInContext(code, ctx)

const CONFIG = run('CONFIG')
const BROADCASTS = run('BROADCASTS')
const COL = run('COL')
const HEADERS = run('HEADERS')
const BCOL = run('BCOL')
const LCOL = run('LCOL')

// --- Subscribers -----------------------------------------------------------
const signups = (tabs[CONFIG.sheetName] = makeTab(CONFIG.sheetName))
signups.appendRow(HEADERS)
const addSignup = (email, firstName, status, token) => {
  const r = new Array(HEADERS.length).fill('')
  r[COL.email] = email
  r[COL.firstName] = firstName
  r[COL.status] = status
  r[COL.token] = token || crypto.randomBytes(16).toString('hex')
  signups.appendRow(r)
  return r[COL.token]
}
for (let i = 1; i <= 75; i++) addSignup(`person${i}@example.com`, i === 1 ? 'Jane <b>' : `P${i}`, 'active')
addSignup('Person2@Example.com', 'Dupe', 'active')                   // same person, second offer
addSignup('gone@example.com', 'Gone', 'unsubscribed')
addSignup('split@example.com', 'Split', 'active')                    // active on one offer...
addSignup('split@example.com', 'Split', 'unsubscribed')              // ...unsubscribed on another
addSignup('not-an-email', 'Bad', 'active')
const janeToken = signups.rows[1][COL.token]
const expectedPeople = 75

const tab = () => tabs[BROADCASTS.sheetName]
const log = () => tabs[BROADCASTS.logSheetName]
const logRows = () => log().rows.slice(1)
const bRow = (n) => tab().rows[n - 1]
const setRow = (n, values) => { tab().rows[n - 1] = values }
const edit = (sheetName, column, lastColumn) => run('onBroadcastEdit')({
  range: {
    getSheet: () => ({ getName: () => sheetName }),
    getColumn: () => column,
    getLastColumn: () => lastColumn || column,
  },
})
const runAll = () => run('runBroadcasts()')

// --- Config ----------------------------------------------------------------
ok('BROADCASTS config present', BROADCASTS && Number(BROADCASTS.dailyLimit) > 0 &&
  BROADCASTS.sendFromHour < BROADCASTS.sendUntilHour && /@/.test(BROADCASTS.testTo))

// --- Setup -----------------------------------------------------------------
run('setupBroadcasts()')
ok('setup makes the Broadcasts tab with headers', tab() && tab().rows[0].join('|') === run('BROADCAST_HEADERS').join('|'))
ok('setup adds one example draft row', tab().rows.length === 2 && bRow(2)[BCOL.status] === 'draft')
ok('setup makes the log tab with headers', log() && log().rows[0].join('|') === run('BROADCAST_LOG_HEADERS').join('|'))
ok('Status dropdown lists every status', ['draft', 'test', 'send', 'tested', 'sending', 'sent', 'error']
  .every((s) => tab().validation.list.includes(s)) && tab().validation.allowInvalid === false)
run('setupBroadcasts()')
ok('setup twice: no duplicate triggers or example rows',
  triggers.length === 2 && tab().rows.length === 2 &&
  triggers.some((t) => t.handler === 'runBroadcasts' && t.everyHours === 1) &&
  triggers.some((t) => t.handler === 'onBroadcastEdit' && t.event === 'edit' && t.sheetId === CONFIG.sheetId))

runAll()
ok('a draft sends nothing', sent.length === 0 && logRows().length === 0)

// --- Test ------------------------------------------------------------------
const message = 'Tomatoes & basil are in.\nCome early.\n\n<script>x</script> See you Saturday.'
setRow(2, ['test', 'Fresh this week', message, 'See the menu', 'https://example.com/menu?a=1&b=2', '', ''])
fakeHour = 22
edit(BROADCASTS.sheetName, 1)
const test = sent[0]
ok('test sends one copy at once, even outside sending hours', sent.length === 1 && test.to[0] === BROADCASTS.testTo)
ok('test subject is marked', test.subject === '[Test] Fresh this week')
ok('test has no one-click header', !test.headers)
ok('test status becomes tested', bRow(2)[BCOL.status] === 'tested' && /Test sent to/.test(bRow(2)[BCOL.progress]))
ok('test is not logged', logRows().length === 0)

sent = []
setRow(2, ['test', 'Fresh this week', message, 'See the menu', 'https://example.com/menu?a=1&b=2', '', ''])
edit('Signups', 1)
edit(BROADCASTS.sheetName, 3)
ok('edits elsewhere do not send', sent.length === 0)
edit(BROADCASTS.sheetName, 1, 7)
ok('a paste across the Status column does send', sent.length === 1)

// --- Validation ------------------------------------------------------------
sent = []
setRow(3, ['send', 'No body', '', '', '', '', ''])
setRow(4, ['send', 'Half a button', 'Hello', 'Click', '', '', ''])
setRow(5, ['test', 'Bad link', 'Hello', 'Click', 'javascript:alert(1)', '', ''])
fakeHour = 10
runAll()
ok('missing message: error, nothing sent', bRow(3)[BCOL.status] === 'error' && /Subject and a Message/.test(bRow(3)[BCOL.progress]))
ok('button text without link: error', bRow(4)[BCOL.status] === 'error')
ok('non-web button link: error', bRow(5)[BCOL.status] === 'error' && /https/.test(bRow(5)[BCOL.progress]))
ok('invalid rows send nothing', sent.length === 0 && logRows().length === 0)
tab().rows.splice(2)

// --- Send: sending hours ---------------------------------------------------
setRow(2, ['send', 'Fresh this week', message, 'See the menu', 'https://example.com/menu?a=1&b=2', '', ''])
fakeHour = 20
edit(BROADCASTS.sheetName, 1)
ok('outside sending hours: waits, sends nothing', sent.length === 0 && bRow(2)[BCOL.status] === 'sending' &&
  /Waiting for sending hours, 9am to 5pm/.test(bRow(2)[BCOL.progress]), bRow(2)[BCOL.progress])
ok('send gets an id', /^[a-f0-9]{12}$/.test(bRow(2)[BCOL.id]))

// --- Send: day one, daily limit ---------------------------------------------
fakeHour = 10
runAll()
const limit = BROADCASTS.dailyLimit
ok('day one stops at the daily limit', sent.length === Math.min(limit, expectedPeople), 'sent ' + sent.length)
ok('each send is logged', logRows().length === sent.length && logRows().every((r) => r[LCOL.result] === 'sent'))
ok('status stays sending with the limit explained', expectedPeople <= limit ||
  (bRow(2)[BCOL.status] === 'sending' && new RegExp(`${limit} of ${expectedPeople} sent\\. Daily limit`).test(bRow(2)[BCOL.progress])),
  bRow(2)[BCOL.progress])

const jane = sent.find((m) => m.to[0] === 'person1@example.com')
ok('greets by first name, escaped', jane && jane.html.includes('Hi Jane &lt;b&gt;,'))
ok('message escaped, paragraphs and line breaks kept', jane.html.includes('<p>Tomatoes &amp; basil are in.<br>Come early.</p>') &&
  jane.html.includes('&lt;script&gt;') && !jane.html.includes('<script>'))
ok('button links out', jane.html.includes('href="https://example.com/menu?a=1&amp;b=2"') && jane.html.includes('See the menu'))
ok('plain text has the link and footer', jane.text.includes('See the menu: https://example.com/menu?a=1&b=2') &&
  jane.text.includes(CONFIG.postalAddress) && jane.text.includes('Unsubscribe: '))
ok('footer: postal address and this person\'s unsubscribe link',
  jane.html.includes(CONFIG.siteUrl + '/unsubscribe/?u=' + janeToken))
ok('one-click header carries this person\'s token', jane.headers &&
  jane.headers['List-Unsubscribe'].includes('?u=' + janeToken) && jane.headers['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click')
ok('subject has no test marker', jane.subject === 'Fresh this week')

const before = sent.length
runAll()
ok('same day again: nothing more', sent.length === before)

// --- Someone unsubscribes overnight ---------------------------------------
const waitingEmails = Array.from({ length: expectedPeople }, (_, i) => `person${i + 1}@example.com`)
  .filter((e) => !sent.some((m) => m.to[0] === e))
const leaver = waitingEmails[0]
const leaverRow = signups.rows.find((r) => r[COL.email] === leaver)
if (leaverRow) leaverRow[COL.status] = 'unsubscribed'
rejectAddress = waitingEmails[1] || ''

// --- Day two ---------------------------------------------------------------
now += 24 * 3600 * 1000
runAll()
const all = sent.map((m) => m.to[0].toLowerCase())
ok('day two finishes the list', bRow(2)[BCOL.status] === 'sent', bRow(2)[BCOL.progress])
ok('nobody gets it twice', new Set(all).size === all.length)
ok('duplicate signup rows get one email', all.filter((e) => e === 'person2@example.com').length === 1)
ok('unsubscribed people get nothing', !all.includes('gone@example.com') && !all.includes('split@example.com'))
ok('unsubscribed overnight: skipped', !leaverRow || !all.includes(leaver))
ok('rejected address logged as failed, not retried', !rejectAddress ||
  logRows().some((r) => r[LCOL.email] === rejectAddress && /^failed: Invalid `to` field\./.test(r[LCOL.result])))
ok('finished line counts sent and failed', new RegExp(`Sent to ${all.length} people, 1 address failed`).test(bRow(2)[BCOL.progress]) ||
  (!rejectAddress && /Sent to/.test(bRow(2)[BCOL.progress])), bRow(2)[BCOL.progress])
const afterDone = sent.length
runAll()
ok('a finished send stays finished', sent.length === afterDone && bRow(2)[BCOL.status] === 'sent')

// --- Outage and quota: pause, then resume -----------------------------------
const addPeople = (n, prefix) => { for (let i = 1; i <= n; i++) addSignup(`${prefix}${i}@example.com`, 'New', 'active') }
now += 24 * 3600 * 1000
addPeople(5, 'late')
setRow(3, ['send', 'Second one', 'Market is on.', '', '', '', ''])
resendMode = 'quota'
sent = []
runAll()
ok('Resend quota: pauses with its message, logs nothing',
  sent.length === 0 && bRow(3)[BCOL.status] === 'sending' &&
  /Paused: You have reached your daily email sending quota\./.test(bRow(3)[BCOL.progress]) &&
  !logRows().some((r) => r[LCOL.id] === bRow(3)[BCOL.id]), bRow(3)[BCOL.progress])
resendMode = 'down'
runAll()
ok('network failure: pauses too', sent.length === 0 && /Paused:/.test(bRow(3)[BCOL.progress]))
resendMode = 'ok'

setRow(3, ['draft', ...bRow(3).slice(1)])
runAll()
ok('set back to draft: stops', sent.length === 0)
setRow(3, ['send', ...bRow(3).slice(1)])
const secondTotal = expectedPeople - 1 + 5   // the overnight leaver is gone; rejected address is still active
runAll()
ok('resumes after the pause', sent.length === Math.min(limit, secondTotal - (rejectAddress ? 1 : 0)), 'sent ' + sent.length)

// --- Overlap guard ---------------------------------------------------------
now += 24 * 3600 * 1000
setRow(4, ['send', 'Third one', 'Hello again.', '', '', '', ''])
sent = []
props.BROADCAST_RUNNING = String(now - 60 * 1000)
runAll()
ok('another run in progress: this one does nothing', sent.length === 0)
props.BROADCAST_RUNNING = String(now - 8 * 60 * 1000)
runAll()
ok('stale run flag from a crash is ignored', sent.length > 0)
ok('run flag cleared afterwards', props.BROADCAST_RUNNING === undefined)

// --- Formula-looking subject in the log ------------------------------------
now += 24 * 3600 * 1000
tab().rows.splice(1)
setRow(2, ['send', '=IMPORTXML("x")', 'Hi.', '', '', '', ''])
runAll()
ok('subject neutralised in the log', logRows().some((r) => r[LCOL.subject] === "'=IMPORTXML(\"x\")"))

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)
