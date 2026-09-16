/**
 * CONFIG: the only file you edit for a new client.
 *
 * Code.gs and Emails.gs are the engine and stay the same from one install to
 * the next. Fill in every FILL_ME below. The skill's scripts/test-backend.js
 * refuses to pass while any FILL_ME is left, except webAppUrl, which you only
 * get after the first deploy.
 */

const CONFIG = {
  // Shown in email footers, the owner notices, and the unsubscribe hand-off.
  brandName: 'FILL_ME Business Name',

  // The sender name people see. The address itself comes from the RESEND_FROM
  // script property, for example "Business Name <hello@mail.example.com>".
  fromName: 'FILL_ME Business Name',

  // Where replies go when a subscriber hits reply. A real, monitored inbox.
  replyTo: 'FILL_ME@example.com',

  // Who gets the "new signup" and "unsubscribed" notices.
  ownerNotifyTo: 'FILL_ME@example.com',

  // CAN-SPAM requires a real physical postal address in every commercial
  // email. A USPS-registered PO box counts. It goes in every footer.
  postalAddress: 'FILL_ME street or PO box, city, state, ZIP',

  // Why the person is getting mail at all. Goes in every footer.
  footerReason: 'You are getting this because you signed up at our website.',

  // The Sheet that stores signups: docs.google.com/spreadsheets/d/THIS_PART/edit
  // The script creates the tab and its header row on the first request.
  sheetId: 'FILL_ME',
  sheetName: 'Signups',

  // The public site, no trailing slash. The unsubscribe page lives at
  // siteUrl + '/unsubscribe/'.
  siteUrl: 'https://FILL_ME.com',

  // The deployed Web App URL. Deploy once, paste the URL here, then deploy a
  // New version. The one-click List-Unsubscribe header is built from it.
  webAppUrl: 'FILL_AFTER_FIRST_DEPLOY',

  // Email and hand-off page colors. Buttons use dark text on `button` when the
  // brand color is light; check contrast (4.5:1) before changing buttonText.
  colors: {
    button: '#0a7a45',
    buttonText: '#ffffff',
    link: '#0a7a45',
    text: '#1f2933',
    muted: '#52606d',
    rule: '#e3e7ec',
  },
}

/**
 * OFFERS: one entry per signup form or lead magnet. The key must match the
 * `offer` value the site posts. With a single offer the site can omit it.
 *
 * downloads: zero or more files. Each gets an optional paragraph and a button
 *            in the email, and a button on the site's thank-you screen.
 *            Leave the array empty for a plain signup with no files.
 * bundle:    optional zip of all the files, shown as a text link. null for none.
 *
 * Every string in intro, text, outro and signoff is plain text. It is escaped
 * before it goes into the email, so do not put HTML in it.
 *
 * sequence is the follow-up drip, off by default. `afterDays` counts from the
 * PREVIOUS message. To turn it on: write the copy, move it into `sequence`,
 * redeploy, and run installTrigger once from the editor.
 */
const FILES_URL = 'https://files.FILL_ME.com'

const OFFERS = {
  main: {
    // Used in the owner notice: "Jane just signed up for the <label>."
    label: 'FILL_ME free guide',

    subject: 'FILL_ME Your free guide is here',
    intro: ['FILL_ME Thanks for signing up. Here is your free guide.'],
    downloads: [
      // { text: 'Optional paragraph above the button.', label: 'Download the guide', url: FILES_URL + '/guide.pdf' },
    ],
    bundle: null, // { label: 'Download everything as one zip file', url: FILES_URL + '/everything.zip' }
    outro: [],
    signoff: ['FILL_ME See you soon,', 'FILL_ME Business Name'],

    sequence: [],
    sequenceDraft: [
      { afterDays: 3, subject: 'Write me', body: ['Short and useful. No selling yet.'] },
    ],
  },
}

/**
 * Stop the drip when the daily quota gets this low, so a long run does not die
 * halfway and leave the sheet half-updated. Only matters for MailApp; Resend
 * has its own limits (free plan: 100 a day, 3,000 a month).
 */
const QUOTA_FLOOR = 10
