/**
 * Sending, and the templates. The wording lives in Config.gs (OFFERS); this
 * file only lays it out.
 *
 * sendMail() is an adapter with two bodies behind it:
 *
 *   Resend   (used when RESEND_API_KEY is set) sends from the client's own
 *            domain, adds List-Unsubscribe headers, far better inbox placement.
 *   MailApp  (fallback) sends from the Google account's Gmail. No custom
 *            headers, 100 recipients a day on free Gmail. Fine for testing.
 *
 * Script properties (Project Settings > Script Properties), set by the owner:
 *   RESEND_API_KEY   a Resend key with Sending access, scoped to one domain
 *   RESEND_FROM      "Business Name <hello@mail.example.com>"
 *
 * Every sendMail() option: to, subject, html, text, and optionally replyTo
 * (defaults to CONFIG.replyTo) and unsubscribeToken (adds List-Unsubscribe).
 */

function sendMail(options) {
  const props = PropertiesService.getScriptProperties()
  const apiKey = props.getProperty('RESEND_API_KEY')

  if (apiKey) {
    sendViaResend(options, apiKey, props.getProperty('RESEND_FROM'))
  } else {
    sendViaMailApp(options)
  }
}

function sendViaMailApp(options) {
  MailApp.sendEmail({
    to: options.to,
    subject: options.subject,
    htmlBody: options.html,
    body: options.text,
    name: CONFIG.fromName,
    replyTo: options.replyTo || CONFIG.replyTo,
  })
}

function sendViaResend(options, apiKey, from) {
  const payload = {
    from: from || (CONFIG.fromName + ' <' + CONFIG.replyTo + '>'),
    to: [options.to],
    subject: options.subject,
    html: options.html,
    text: options.text,
    reply_to: options.replyTo || CONFIG.replyTo,
  }

  // Gmail and Yahoo both look for this. It puts a real Unsubscribe button in
  // the mail client's own chrome, above the message. MailApp cannot do this.
  // The URL is the Web App itself, because one-click means the mail provider
  // POSTs to it directly. doPost handles that body before anything else.
  if (options.unsubscribeToken) {
    payload.headers = {
      'List-Unsubscribe': '<' + oneClickUnsubscribeUrl(options.unsubscribeToken) + '>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    }
  }

  const response = UrlFetchApp.fetch('https://api.resend.com/emails', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  })

  if (response.getResponseCode() >= 300) {
    throw new Error('Resend rejected the message: ' + response.getContentText())
  }
}

// ---------------------------------------------------------------------------
// The messages
// ---------------------------------------------------------------------------

/** The email the person gets straight after signing up. */
function sendGuideEmail(args) {
  const offer = args.offer
  const name = args.firstName ? escapeHtml(args.firstName) : 'there'
  const unsubscribeUrl = unsubscribePageLink(args.token)

  const body = [
    '<p>Hi ' + name + ',</p>',
    paragraphsHtml(offer.intro),
    offer.downloads.map(function (d) {
      return paragraphsHtml(d.text ? [d.text] : []) + buttonHtml(d.url, d.label)
    }).join(''),
    offer.bundle
      ? '<p><a href="' + offer.bundle.url + '" style="color:' + CONFIG.colors.link + '">' +
        escapeHtml(offer.bundle.label) + '</a></p>'
      : '',
    paragraphsHtml(offer.outro),
    '<p>' + offer.signoff.map(escapeHtml).join('<br>') + '</p>',
  ].join('')

  const links = allDownloads(offer)
    .map(function (d) { return d.label + ': ' + d.url })
    .join('\n')

  sendMail({
    to: args.email,
    subject: offer.subject,
    html: wrap(body, unsubscribeUrl),
    text: stripTags(body) + (links ? '\n\n' + links : '') +
          '\n\n' + CONFIG.postalAddress + '\nUnsubscribe: ' + unsubscribeUrl,
    unsubscribeToken: args.token,
  })
}

function sendSequenceEmail(args) {
  const unsubscribeUrl = unsubscribePageLink(args.token)
  const name = args.firstName ? escapeHtml(args.firstName) : 'there'

  const body =
    '<p>Hi ' + name + ',</p>' + paragraphsHtml(args.message.body) +
    '<p>' + escapeHtml(CONFIG.fromName) + '</p>'

  sendMail({
    to: args.email,
    subject: args.message.subject,
    html: wrap(body, unsubscribeUrl),
    text: stripTags(body) + '\n\n' + CONFIG.postalAddress + '\nUnsubscribe: ' + unsubscribeUrl,
    unsubscribeToken: args.token,
  })
}

/**
 * The owners' heads-up. Internal mail, so no unsubscribe footer. Reply goes
 * to the subscriber, so answering a signup is one click.
 */
function sendOwnerNotice(args) {
  const name = args.firstName || '(no name)'
  const when = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'EEE MMM d, h:mm a')

  sendMail({
    to: CONFIG.ownerNotifyTo,
    replyTo: args.email,
    subject: 'New signup: ' + (args.firstName || args.email),
    html:
      '<p><strong>' + escapeHtml(name) + '</strong> just signed up for the ' +
      escapeHtml(args.offer.label) + '.</p>' +
      '<p>Email: ' + escapeHtml(args.email) + '<br>When: ' + escapeHtml(when) + '</p>' +
      '<p>Their email already went out. Nothing to do.</p>' +
      '<p><a href="https://docs.google.com/spreadsheets/d/' + CONFIG.sheetId + '/edit">Open the sheet</a></p>',
    text: name + ' <' + args.email + '> signed up for the ' + args.offer.label + '. ' +
          when + '. Their email already went out. Nothing to do.',
  })
}

/**
 * Tells the owners someone opted out. Internal mail, so no unsubscribe footer.
 * Reply goes to the owners' own inbox, not the person: they asked to stop
 * hearing from us.
 */
function sendUnsubscribeNotice(args) {
  const name = args.firstName || '(no name)'
  const when = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'EEE MMM d, h:mm a')

  sendMail({
    to: CONFIG.ownerNotifyTo,
    subject: 'Unsubscribed: ' + (args.firstName || args.email),
    html:
      '<p><strong>' + escapeHtml(name) + '</strong> unsubscribed from ' +
      escapeHtml(CONFIG.brandName) + ' emails.</p>' +
      '<p>Email: ' + escapeHtml(args.email) + '<br>When: ' + escapeHtml(when) +
      '<br>How: ' + escapeHtml(args.via) + '</p>' +
      '<p>Their row in the sheet is marked unsubscribed, and list emails skip them from now on.</p>' +
      '<p><a href="https://docs.google.com/spreadsheets/d/' + CONFIG.sheetId + '/edit">Open the sheet</a></p>',
    text: name + ' <' + args.email + '> unsubscribed from ' + CONFIG.brandName + ' emails. ' +
          when + ', using ' + args.via + '. Their row in the sheet is marked unsubscribed, ' +
          'and list emails skip them from now on.',
  })
}

// ---------------------------------------------------------------------------
// Shell, footer, and helpers
// ---------------------------------------------------------------------------

/**
 * CAN-SPAM needs a real postal address and a working opt-out in every
 * commercial email, so this footer goes on everything a subscriber receives,
 * the first email included.
 */
function wrap(bodyHtml, unsubscribeUrl) {
  return '' +
    '<div style="font:16px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;' +
    'color:' + CONFIG.colors.text + ';max-width:34rem;margin:0 auto;padding:8px 4px">' +
    bodyHtml +
    '<hr style="border:none;border-top:1px solid ' + CONFIG.colors.rule + ';margin:32px 0 16px">' +
    '<p style="font-size:13px;line-height:1.55;color:' + CONFIG.colors.muted + ';margin:0">' +
    escapeHtml(CONFIG.brandName) + '<br>' +
    escapeHtml(CONFIG.postalAddress) + '<br><br>' +
    escapeHtml(CONFIG.footerReason) + '<br>' +
    '<a href="' + unsubscribeUrl + '" style="color:' + CONFIG.colors.muted + '">Unsubscribe</a>' +
    '</p></div>'
}

/** An email-safe button. Inline styles only: most mail clients drop <style>. */
function buttonHtml(url, label) {
  return '<p style="margin:24px 0"><a href="' + url + '" ' +
    'style="background:' + CONFIG.colors.button + ';color:' + CONFIG.colors.buttonText +
    ';text-decoration:none;font-weight:700;' +
    'padding:14px 26px;border-radius:999px;display:inline-block">' + escapeHtml(label) + '</a></p>'
}

function paragraphsHtml(lines) {
  return (lines || []).map(function (line) { return '<p>' + escapeHtml(line) + '</p>' }).join('')
}

/** Every file for an offer, the zip last. */
function allDownloads(offer) {
  return offer.downloads.concat(offer.bundle ? [offer.bundle] : [])
}

/** The footer link. A page on the site, with a button, so scanners cannot trip it. */
function unsubscribePageLink(token) {
  return CONFIG.siteUrl + '/unsubscribe/?u=' + encodeURIComponent(token)
}

/** The List-Unsubscribe header URL. Mail providers POST here directly. */
function oneClickUnsubscribeUrl(token) {
  return CONFIG.webAppUrl + '?u=' + encodeURIComponent(token)
}

/** Rough plain-text version. Good enough for the text/plain alternative. */
function stripTags(html) {
  return String(html)
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
