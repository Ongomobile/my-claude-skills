#!/usr/bin/env node
/**
 * Renders the emails subscribers get into HTML pages you can open in a
 * browser: the welcome email for every offer, and a sample list email. It runs
 * the real templates from Emails.gs and Broadcasts.gs, so what you see is what
 * gets sent. Nothing is sent anywhere.
 *
 *   node preview-emails.js <apps-script folder> <output folder>
 *   node preview-emails.js <apps-script folder> <output folder> --sample
 *
 * Use it in Phase 0 and 1 to show the owner their email copy before approving
 * it. --sample swaps in a made-up bakery instead of Config.gs, which is how the
 * demo's previews are built from the untouched template.
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const [dir, outDir] = process.argv.slice(2)
const sample = process.argv.includes('--sample')
if (!dir || !outDir || dir.startsWith('--') || outDir.startsWith('--')) {
  console.error('Usage: node preview-emails.js <apps-script folder> <output folder> [--sample]')
  process.exit(2)
}

const read = (name) => fs.readFileSync(path.join(dir, name), 'utf8')
const has = (name) => fs.existsSync(path.join(dir, name))

const SAMPLE_CONFIG = `
const CONFIG = {
  brandName: 'Sample Bakery',
  fromName: 'Sample Bakery',
  replyTo: 'hello@example.com',
  ownerNotifyTo: 'owner@example.com',
  postalAddress: '123 Main Street, Springfield, OR 97477',
  footerReason: 'You are getting this because you signed up at our website.',
  sheetId: 'sample',
  sheetName: 'Signups',
  siteUrl: 'https://example.com',
  webAppUrl: 'https://script.google.com/macros/s/SAMPLE/exec',
  colors: { button: '#0a7a45', buttonText: '#ffffff', link: '#0a7a45', text: '#1f2933', muted: '#52606d', rule: '#e3e7ec' },
}
const FILES_URL = 'https://files.example.com'
const OFFERS = {
  main: {
    label: 'free sourdough guide',
    subject: 'Your sourdough starter guide is here',
    intro: ['Thanks for signing up. Here is the guide we hand out at the counter, with every step we use for our own starter.'],
    downloads: [
      { text: 'Twelve pages, with a photo of each stage.', label: 'Download the guide', url: FILES_URL + '/sourdough-starter-guide.pdf' },
      { text: 'And a coupon for your first loaf, on us.', label: 'Download your coupon', url: FILES_URL + '/first-loaf-coupon.pdf' },
    ],
    bundle: { label: 'Get both as one zip file', url: FILES_URL + '/sourdough-guide-and-coupon.zip' },
    outro: ['Questions about your starter? Hit reply. We read every one.'],
    signoff: ['See you at the bakery,', 'Sam at Sample Bakery'],
    sequence: [],
    sequenceDraft: [],
  },
}
const QUOTA_FLOOR = 10
const BROADCASTS = { sheetName: 'Broadcasts', logSheetName: 'Broadcast log', dailyLimit: 60, sendFromHour: 9, sendUntilHour: 17, testTo: CONFIG.ownerNotifyTo }
`

const configSrc = sample ? SAMPLE_CONFIG : read('Config.gs')
if (!sample && /'[^'\n]*FILL_ME[^'\n]*'/.test(configSrc)) {
  console.error('Config.gs still has FILL_ME values. Fill them in, or pass --sample.')
  process.exit(1)
}

const files = ['Code.gs', 'Emails.gs'].concat(has('Broadcasts.gs') ? ['Broadcasts.gs'] : [])
const source = [configSrc].concat(files.map(read)).join('\n')

const captured = []
const ctx = { console, __captured: captured }
vm.createContext(ctx)
vm.runInContext(source, ctx)
vm.runInContext('sendMail = function (o) { __captured.push(o) }', ctx)
const run = (code) => vm.runInContext(code, ctx)

const token = '0123456789abcdef0123456789abcdef'
const person = { email: 'jane@example.com', firstName: 'Jane' }
const from = run('CONFIG.fromName') + ' <hello@mail.' + run('CONFIG.siteUrl').replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') + '>'

fs.mkdirSync(outDir, { recursive: true })
const written = []

const page = (title, mail, note) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  body { margin: 0; background: #eef1f4; font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #1f2933; }
  .wrap { max-width: 44rem; margin: 0 auto; padding: 24px 16px 64px; }
  .note { font-size: 13px; color: #52606d; margin: 0 0 12px; }
  .head, .body, details { background: #fff; border: 1px solid #d9dee4; border-radius: 10px; }
  .head { padding: 14px 18px; margin-bottom: 10px; }
  .head div { overflow-wrap: anywhere; }
  .head span { display: inline-block; min-width: 5.5em; color: #52606d; }
  .subject { font-size: 18px; font-weight: 700; margin-top: 6px; }
  .body { padding: 20px 14px; overflow-wrap: anywhere; }
  details { margin-top: 10px; padding: 12px 18px; }
  summary { cursor: pointer; font-weight: 600; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; font: 13px/1.55 ui-monospace, Menlo, monospace; }
</style>
</head>
<body>
<div class="wrap">
  <p class="note">${escapeHtml(note)}</p>
  <div class="head">
    <div><span>From</span>${escapeHtml(from)}</div>
    <div><span>To</span>${escapeHtml(mail.to)}</div>
    <div><span>Reply-to</span>${escapeHtml(mail.replyTo || run('CONFIG.replyTo'))}</div>
    <div class="subject">${escapeHtml(mail.subject)}</div>
  </div>
  <div class="body">${mail.html}</div>
  <details><summary>Plain-text version</summary><pre>${escapeHtml(mail.text)}</pre></details>
</div>
</body>
</html>
`

const write = (name, html) => {
  const file = path.join(outDir, name)
  fs.writeFileSync(file, html)
  written.push(file)
}

for (const key of Object.keys(run('OFFERS'))) {
  captured.length = 0
  run(`sendGuideEmail({ email: ${JSON.stringify(person.email)}, firstName: ${JSON.stringify(person.firstName)}, offer: OFFERS[${JSON.stringify(key)}], token: ${JSON.stringify(token)} })`)
  write(`welcome-${key}.html`, page('Welcome email preview', captured[0],
    'Preview of the welcome email for the "' + key + '" offer, sent the moment someone signs up. Links in the footer point at your site.'))
}

if (files.includes('Broadcasts.gs')) {
  captured.length = 0
  run(`sendBroadcastEmail({
    email: ${JSON.stringify(person.email)},
    firstName: ${JSON.stringify(person.firstName)},
    token: ${JSON.stringify(token)},
    broadcast: {
      subject: 'Rye is back this Saturday',
      message: 'Our dark rye is back in the case this Saturday, and it goes fast.\\n\\nCome before 10 if you want a loaf. We are also trying a new seeded sourdough, and we would love to know what you think.',
      buttonText: 'See this week\\'s bakes',
      buttonLink: ${JSON.stringify(run('CONFIG.siteUrl') + '/menu')},
    },
  })`)
  write('list-email.html', page('List email preview', captured[0],
    'Preview of a list email written in the Broadcasts tab. The words are an example; the greeting, button and footer are what every list email gets.'))
}

written.forEach((f) => console.log('wrote ' + f))

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
