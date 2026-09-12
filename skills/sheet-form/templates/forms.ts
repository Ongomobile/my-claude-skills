/* The one road out of this site.

   Every form posts to the same Google Apps Script Web App. The script reads
   `kind` off the body and decides which sheet tab to write and which emails to
   send. Setup is in apps-script/README.md. */
const endpoint = import.meta.env.VITE_FORMS_ENDPOINT as string | undefined;

/** False when no endpoint is set. Every form checks this and offers email
    instead, rather than showing a thank-you for a message that went nowhere. */
export const formsConfigured = Boolean(endpoint);

export type SubmitResult = { ok: true } | { ok: false; reason: 'unconfigured' | 'failed' };

/**
 * Post one body to the Apps Script.
 *
 * The body goes as plain text with no custom headers, deliberately. That makes
 * it a "simple request", so the browser sends it straight through instead of
 * asking permission first with a preflight OPTIONS call that Apps Script has no
 * way to answer. Adding a Content-Type header here breaks it with a CORS error.
 */
export async function postForm(body: Record<string, unknown>): Promise<SubmitResult> {
  if (!endpoint) return { ok: false, reason: 'unconfigured' };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify(body),
    });
    if (!response.ok) return { ok: false, reason: 'failed' };

    const result = (await response.json().catch(() => ({ ok: true }))) as { ok?: boolean };
    return result.ok === false ? { ok: false, reason: 'failed' } : { ok: true };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/**
 * How long the form has been on screen.
 *
 * Call `since` when the form mounts and send `seconds` with the post. Bots fill
 * instantly; people do not. The script drops anything under its own threshold.
 */
export function since(start: number): number {
  return Math.round((Date.now() - start) / 1000);
}
