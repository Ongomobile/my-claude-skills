#!/usr/bin/env node
/**
 * Runs the Apps Script backend in Node against fake Google services and checks
 * every route: signup, honeypot, Turnstile, dedupe and cooldown, both
 * unsubscribe routes, the owner notices, resubscribe, and offers with and
 * without downloads. Nothing is sent anywhere.
 *
 *   node test-backend.js <folder with Config.gs, Code.gs, Emails.gs>
 *   node test-backend.js <folder> --allow-placeholders   (testing the template itself)
 *
 * Exit code 0 means every check passed.
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const crypto = require('crypto')

const dir = process.argv[2]
const allowPlaceholders = process.argv.includes('--allow-placeholders')
if (!dir) {
  console.error('Usage: node test-backend.js <apps-script folder> [--allow-placeholders]')
  process.exit(2)
}

const read = (name) => fs.readFileSync(path.join(dir, name), 'utf8')
const configSrc = read('Config.gs')
const source = [configSrc, read('Code.gs'), read('Emails.gs')].join('\n')

let failures = 0
const ok = (name, cond, detail) => {
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !detail ? '' : '  -> ' + detail))
  if (!cond) failures++
}

// Only quoted values count; the comments mention FILL_ME too.
const leftovers = (configSrc.match(/'[^'\n]*FILL_ME[^'\n]*'/g) || [])
if (!allowPlaceholders) {
  ok('Config.gs has no FILL_ME left', leftovers.length === 0, leftovers.slice(0, 5).join(' | '))
  if (configSrc.includes('FILL_AFTER_FIRST_DEPLOY')) {
    console.log('NOTE webAppUrl is still unset. Fine before the first deploy, not after.')
  }
}

// --- Fake Google -----------------------------------------------------------
let rows = []
let sent = []
let resendDown = false
const sheet = {
  getLastRow: () => rows.length,
  appendRow: (r) => rows.push([...r]),
  setFrozenRows() {},
  getDataRange: () => ({ getValues: () => rows.map((r) => [...r]) }),
  getRange: (r, c) => ({ setValue: (v) => { rows[r - 1][c - 1] = v } }),
}
const cacheStore = {}
const ctx = {
  console: { log() {}, error() {} },
  SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  CacheService: { getScriptCache: () => ({ get: (k) => cacheStore[k], put: (k, v) => { cacheStore[k] = v } }) },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: (k) => ({ TURNSTILE_SECRET: 'secret', RESEND_API_KEY: 'key', RESEND_FROM: 'Test <hello@mail.example.com>' })[k],
    }),
  },
  UrlFetchApp: {
    fetch: (url, o) => {
      if (url.includes('turnstile')) {
        return { getContentText: () => JSON.stringify({ success: o.payload.response === 'good' }) }
      }
      if (resendDown) throw new Error('resend down')
      sent.push(JSON.parse(o.payload))
      return { getResponseCode: () => 200, getContentText: () => '{}' }
    },
  },
  MailApp: { sendEmail: (m) => sent.push(m), getRemainingDailyQuota: () => 100 },
  Utilities: { getUuid: () => crypto.randomUUID(), formatDate: () => 'Wed Sep 16, 9:00 AM' },
  Session: { getScriptTimeZone: () => 'America/New_York' },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => ({ body: JSON.parse(t) }) }) },
  HtmlService: { XFrameOptionsMode: { DENY: 1 }, createHtmlOutput: (h) => ({ setXFrameOptionsMode: () => ({ html: h }) }) },
}
vm.createContext(ctx)
vm.runInContext(source + '\nthis.doPost = doPost; this.doGet = doGet;', ctx)
const run = (code) => vm.runInContext(code, ctx)

const CONFIG = run('CONFIG')
const offerKey = run('Object.keys(OFFERS)[0]')
const post = (body, parameter = {}) =>
  ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) }, parameter }).body
const last = () => sent[sent.length - 1]
const COL = run('COL')
const row = () => rows[1]

// Test with files, so the download paths run even if the real offer has none.
const realOffer = run(`JSON.stringify(OFFERS[${JSON.stringify(offerKey)}])`)
run(`OFFERS[${JSON.stringify(offerKey)}].downloads = OFFERS[${JSON.stringify(offerKey)}].downloads.length
  ? OFFERS[${JSON.stringify(offerKey)}].downloads
  : [{ text: 'Here is the file.', label: 'Download the file', url: 'https://files.example.com/a.pdf' },
     { label: 'Download the other one', url: 'https://files.example.com/b.pdf' }]`)
run(`OFFERS[${JSON.stringify(offerKey)}].bundle = OFFERS[${JSON.stringify(offerKey)}].bundle
  || { label: 'Get both as a zip', url: 'https://files.example.com/both.zip' }`)
const offer = run(`OFFERS[${JSON.stringify(offerKey)}]`)
const fileUrls = offer.downloads.map((d) => d.url).concat(offer.bundle ? [offer.bundle.url] : [])

// --- Checks ----------------------------------------------------------------
ok('health check', ctx.doGet({ parameter: {} }).body.service !== undefined)
ok('honeypot writes no row', post({ email: 'a@b.co', company: 'x', turnstileToken: 'good' }).ok && rows.length === 0)
ok('bad email rejected', post({ email: 'nope', turnstileToken: 'good' }).error === 'invalid email')
ok('missing Turnstile token rejected', post({ email: 'a@b.co' }).error === 'verification failed' && rows.length === 0)
ok('bad Turnstile token rejected', post({ email: 'a@b.co', turnstileToken: 'bad' }).error === 'verification failed')
ok('unknown offer rejected', post({ email: 'a@b.co', offer: 'constructor', turnstileToken: 'good' }).error === 'unknown offer')

const r = post({ email: 'Jane@Example.com', firstName: '=HYPERLINK("x")', turnstileToken: 'good' })
ok('signup ok', r.ok === true, JSON.stringify(r))
ok('reply lists every download', JSON.stringify((r.downloads || []).map((d) => d.url)) === JSON.stringify(fileUrls))
ok('row written, email lowercased', rows.length === 2 && row()[COL.email] === 'jane@example.com')
ok('formula in name neutralised', String(row()[COL.firstName]).startsWith("'="))
ok('guide email + owner notice sent', sent.length === 2, 'sent ' + sent.length)

const guide = sent[0]
const owner = sent[1]
const token = row()[COL.token]
ok('guide email to subscriber', guide.to[0] === 'jane@example.com')
ok('guide subject from Config', guide.subject === offer.subject)
ok('guide has every file link', fileUrls.every((u) => guide.html.includes(u) && guide.text.includes(u)))
ok('guide footer has postal address', guide.html.includes(escapeHtml(CONFIG.postalAddress)))
ok('footer links to site unsubscribe page', guide.html.includes(CONFIG.siteUrl + '/unsubscribe/?u=' + token))
ok('List-Unsubscribe one-click header', guide.headers && guide.headers['List-Unsubscribe'].includes('?u=' + token) &&
  guide.headers['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click')
ok('guide replies go to replyTo', guide.reply_to === CONFIG.replyTo)
ok('owner notice to ownerNotifyTo', owner.to[0] === CONFIG.ownerNotifyTo)
ok('owner notice reply goes to subscriber', owner.reply_to === 'jane@example.com')
ok('owner notice has no unsubscribe header', !owner.headers)
ok('HTML escaped in notices', owner.html.includes('=HYPERLINK(&quot;x&quot;)') && !owner.html.includes('HYPERLINK("x")'))

post({ email: 'jane@example.com', firstName: 'Jane', turnstileToken: 'good' })
ok('repeat signup: one row, no email inside cooldown', rows.length === 2 && sent.length === 2)

ok('GET ?u= does not unsubscribe', ctx.doGet({ parameter: { u: token } }).html.includes('target="_top"') && row()[COL.status] === 'active')

let n = sent.length
ok('unknown token: ok, no change, no notice', post({ action: 'unsubscribe', token: 'f'.repeat(32) }).ok &&
  row()[COL.status] === 'active' && sent.length === n)
ok('unsubscribe page route', post({ action: 'unsubscribe', token }).ok && row()[COL.status] === 'unsubscribed')
ok('unsubscribe notice sent to owner', sent.length === n + 1 && last().to[0] === CONFIG.ownerNotifyTo &&
  last().subject.startsWith('Unsubscribed: '))
n = sent.length
ok('second click sends no second notice', post({ action: 'unsubscribe', token }).ok && sent.length === n)

rows[1][COL.status] = 'active'
ok('one-click List-Unsubscribe POST', post('List-Unsubscribe=One-Click', { u: token }).ok &&
  row()[COL.status] === 'unsubscribed' && sent.length === n + 1)

rows[1][COL.status] = 'active'
resendDown = true
ok('failed notice still unsubscribes', post({ action: 'unsubscribe', token }).ok && row()[COL.status] === 'unsubscribed')
resendDown = false

n = sent.length
ok('resubscribe inside cooldown: active at once, no email',
  post({ email: 'jane@example.com', firstName: 'Jane', turnstileToken: 'good' }).ok &&
  row()[COL.status] === 'active' && String(row()[COL.notes]).startsWith('resubscribed ') && sent.length === n)

rows[1][COL.status] = 'unsubscribed'
rows[1][COL.lastGuideSentAt] = new Date(Date.now() - 2 * 3600 * 1000)
ok('resubscribe after cooldown: active and emailed',
  post({ email: 'jane@example.com', firstName: 'Jane', turnstileToken: 'good' }).ok &&
  row()[COL.status] === 'active' && sent.length === n + 1 && last().subject === offer.subject)

// An offer with no files: plain signup confirmation.
run(`OFFERS[${JSON.stringify(offerKey)}].downloads = []; OFFERS[${JSON.stringify(offerKey)}].bundle = null`)
n = sent.length
const plain = post({ email: 'sam@example.com', firstName: 'Sam', turnstileToken: 'good' })
ok('no-download offer: ok with empty downloads', plain.ok && Array.isArray(plain.downloads) && plain.downloads.length === 0)
ok('no-download offer: email and notice still sent', sent.length === n + 2 && !sent[n].html.includes('undefined'))
run(`OFFERS[${JSON.stringify(offerKey)}] = ${realOffer}`)

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.')
process.exit(failures ? 1 : 0)

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
