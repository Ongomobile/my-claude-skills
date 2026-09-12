/**
 * <SITE> forms backend.
 *
 * One Web App, every form on the site. The page posts a `kind` and this picks
 * the matching entry in FORMS below. A new form is a new entry here plus a new
 * submit function on the client. It is not a second deployment.
 *
 * Paste this into an Apps Script project BOUND to the sheet you want the rows
 * in (Extensions > Apps Script from inside the sheet), then deploy it as a Web
 * App. Setup steps are in apps-script/README.md.
 *
 * Every path does the same things, in order:
 *   1. Drop bots: honeypot filled, or the form was filled impossibly fast, or
 *      the Turnstile token does not check out. Silently, with a 200, so a bot
 *      learns nothing from the answer.
 *   2. Append a row to that form's tab, made by its `row` function.
 *   3. Email the person who filled it in.
 *   4. Email the owner.
 */

// ------------------------------------------------------------------- config

var CONFIG = {
  /** Where owner notifications go. */
  ownerEmail: 'you@example.com',

  /** Sender name on every email. */
  fromName: '<Site>',

  /**
   * Anything filled in faster than this is a bot. Set to 0 to switch the check
   * off. The client sends `seconds` as the time since the form appeared.
   */
  minSeconds: 3,

  /**
   * Turnstile. Leave the property missing to switch it off. When it is set,
   * every form must send a `token`.
   *
   * Put the SECRET key in Project Settings > Script Properties under the name
   * TURNSTILE_SECRET. Never in this file, and never in the repo.
   */
  turnstileSecret: PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET'),
};

// -------------------------------------------------------------------- forms

/**
 * One entry per form.
 *
 *   sheet     the tab name. Created on first use.
 *   headings  row 1. Must line up with what `row` returns.
 *   row       turns the posted body into the cells to append.
 *   dedupe    when true, a repeat email address is accepted and not written
 *             twice, and gets no second email. Right for a list you join once.
 *             Wrong for messages: two messages are two messages.
 *   confirm   the email back to the sender. Return null to send none.
 *   notify    the email to the owner. Return null to send none.
 */
var FORMS = {
  contact: {
    sheet: 'Messages',
    headings: ['When', 'Name', 'Email', 'Message'],
    dedupe: false,

    row: function (b) {
      return [new Date(), b.name, b.email, b.message];
    },

    confirm: function (b) {
      return {
        subject: 'I got your message',
        body: [
          'Hi ' + b.name + ',',
          '',
          'Thanks for writing in. This is just to tell you it arrived.',
          '',
          'Here is what you sent, so you have a copy:',
          '',
          b.message,
          '',
          '---',
          '',
          'If you thought of something else, reply to this email.',
          '',
          '<Your name>',
        ].join('\n'),
      };
    },

    notify: function (b) {
      return {
        // Reply in your mail client and it goes to them, not to yourself.
        replyTo: b.email,
        subject: 'Message from ' + b.name,
        body: [
          'Somebody wrote in from the site.',
          '',
          'Name:   ' + b.name,
          'Email:  ' + b.email,
          'When:   ' + new Date().toString(),
          '',
          '---',
          '',
          b.message,
        ].join('\n'),
      };
    },
  },
};

/** Fields that are trimmed and length-capped before anything else touches them. */
var LIMITS = { name: 80, message: 5000, subject: 200 };

// -------------------------------------------------------------------- entry

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    // The honeypot. A real person never sees that field, so anything in it is a
    // bot. Return ok rather than an error: a rejection tells it what to change.
    if (body.website) return json({ ok: true });

    // Too fast to have been typed.
    if (CONFIG.minSeconds && Number(body.seconds) >= 0 && Number(body.seconds) < CONFIG.minSeconds) {
      return json({ ok: true });
    }

    if (CONFIG.turnstileSecret && !turnstileOk(body.token)) {
      return json({ ok: true });
    }

    var form = FORMS[body.kind] || FORMS[Object.keys(FORMS)[0]];

    var email = String(body.email || '').trim();
    if (!isEmail(email)) return json({ ok: false, error: 'bad-email' });

    var clean = tidy(body);
    clean.email = email;

    if (form.headings.indexOf('Message') !== -1 && !clean.message) {
      return json({ ok: false, error: 'empty-message' });
    }

    var sheet = getSheet(form.sheet, form.headings);

    if (form.dedupe && alreadyListed(sheet, form.headings, email)) {
      return json({ ok: true, duplicate: true });
    }

    sheet.appendRow(form.row(clean));

    send(email, form.confirm(clean));
    send(CONFIG.ownerEmail, form.notify(clean));

    return json({ ok: true });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'server' });
  }
}

/** Open the deployment URL in a browser and you should see this. */
function doGet() {
  return json({ ok: true, service: 'forms' });
}

// ----------------------------------------------------------------- plumbing

/** Trim every string in the body and cap the ones named in LIMITS. */
function tidy(body) {
  var out = {};
  for (var key in body) {
    var value = body[key];
    if (typeof value === 'string') {
      value = value.trim();
      if (LIMITS[key]) value = value.slice(0, LIMITS[key]);
    }
    out[key] = value;
  }
  if (out.name === '') out.name = 'Someone';
  return out;
}

function send(to, mail) {
  if (!mail) return;
  MailApp.sendEmail({
    to: to,
    name: CONFIG.fromName,
    replyTo: mail.replyTo,
    subject: mail.subject,
    body: mail.body,
  });
}

/**
 * Ask Cloudflare whether the token is real.
 *
 * Fails closed on a network error: a form that cannot be checked is not let
 * through. That costs a real person one retry and costs a bot everything.
 */
function turnstileOk(token) {
  if (!token) return false;
  try {
    var response = UrlFetchApp.fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'post',
        payload: { secret: CONFIG.turnstileSecret, response: token },
        muteHttpExceptions: true,
      },
    );
    return JSON.parse(response.getContentText()).success === true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

/** Find a tab by name, or make it with the headings given and freeze row 1. */
function getSheet(name, headings) {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    sheet.appendRow(headings);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function alreadyListed(sheet, headings, email) {
  var column = headings.indexOf('Email') + 1;
  var rows = sheet.getLastRow();
  if (column < 1 || rows < 2) return false;

  var values = sheet.getRange(2, column, rows - 1, 1).getValues();
  var wanted = email.toLowerCase();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim().toLowerCase() === wanted) return true;
  }
  return false;
}

function isEmail(value) {
  return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(value) && value.length < 254;
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
