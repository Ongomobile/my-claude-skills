/**
 * Signup client. No framework, no dependencies. Works in plain HTML, Vue,
 * React, Svelte, anything that can import an ES module.
 *
 * Fill in the three constants, then call submitSignup() from your form.
 * Neither ENDPOINT nor the Turnstile SITE key is a secret, so they live in
 * code. (A VITE_/NEXT_PUBLIC_ env var only reaches the bundle if it is set on
 * the host before the build; forgetting that ships a form that does nothing.)
 */

export const ENDPOINT = '' // Apps Script Web App URL, ends in /exec
export const TURNSTILE_SITE_KEY = '' // public site key from the Turnstile widget

/**
 * The same files as OFFERS in Config.gs (label + url, zip last). The thank-you
 * screen falls back to these when Google loses the script's reply, so getting
 * the files never depends on the round trip. Empty array for a plain signup.
 */
export const DOWNLOADS = [
  // { label: 'Download the guide', url: 'https://files.example.com/guide.pdf' },
]

/** Permissive check. The server validates again. */
export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value).trim())
}

/**
 * Thrown when the reply was lost in Google's redirect rather than rejected by
 * the script. See readReply. Safe to retry: the script dedupes on email and
 * sends no second email inside an hour.
 */
export class LostReplyError extends Error {}

/**
 * Send one signup, retrying once if Google loses the reply.
 *
 * @param {object} args
 * @param {{ email: string, firstName?: string, offer?: string }} args.fields
 * @param {{ getToken: () => Promise<string>, reset: () => void }} [args.turnstile]
 *        From createTurnstile() in turnstile.js. Omit only in local stub mode.
 * @returns {Promise<{ ok: true, downloads: Array<{ label: string, url: string }> }>}
 * @throws Error with a message for a real rejection (bad email, failed check)
 */
export async function submitSignup({ fields, turnstile }) {
  const send = async () =>
    post({
      email: String(fields.email).trim(),
      firstName: String(fields.firstName ?? '').trim(),
      ...(fields.offer ? { offer: fields.offer } : {}),
      turnstileToken: turnstile ? await turnstile.getToken() : '',
    })

  let result
  try {
    result = await send()
  } catch (error) {
    if (!(error instanceof LostReplyError)) throw error
    console.warn('[signup] Reply lost, retrying once:', error)
    // The first token is spent whether or not the script saw it.
    turnstile?.reset()
    result = await send()
  }
  return { ok: true, downloads: result.downloads ?? DOWNLOADS }
}

/**
 * WHY Content-Type IS text/plain
 * Anything else (application/json) makes the browser send a CORS preflight
 * OPTIONS request, which Apps Script cannot answer, and the POST fails with a
 * CORS error that looks like a network fault. The body is still JSON.
 */
async function post(payload) {
  if (!ENDPOINT) throw new Error('ENDPOINT is not set in signup.js')

  let response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow', // Apps Script answers with a redirect to googleusercontent.com
    })
  } catch (error) {
    throw new LostReplyError(`Network error: ${error.message}`)
  }
  if (!response.ok) throw new LostReplyError(`HTTP ${response.status}`)

  const result = await readReply(response)
  // Rejections come back as HTTP 200 with { ok: false, error }.
  if (!result.ok) throw new Error(`Rejected: ${result.error ?? 'unknown reason'}`)
  return result
}

/**
 * WHY THE REPLY IS NOT JUST response.json()
 * Apps Script runs doPost, stores the output, and redirects the browser to
 * collect it. Measured in production (2026-09-16): about one request in
 * fifteen loses the stored output. Google bounces the browser back to /exec,
 * which answers with doGet's health check, or serves a Drive "unable to open
 * the file" HTML page. doPost has already run by then, because that first
 * redirect is only issued after it finishes.
 *   health check reply ({ service }) -> the signup went through
 *   anything that is not JSON        -> LostReplyError, caller retries
 */
async function readReply(response) {
  const text = await response.text()
  let result
  try {
    result = JSON.parse(text)
  } catch {
    throw new LostReplyError('Reply was not JSON')
  }
  return result && result.service ? { ok: true } : result
}
