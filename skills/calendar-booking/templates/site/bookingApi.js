/**
 * Booking client for the Apps Script backend. Plain ES module, no framework.
 *
 *   const client = createBookingClient({ endpoint })
 *   const { slots, timeZone } = await client.getSlots()
 *   await client.bookCall({ name, email, workingOn, website, timeZone, start, bookingId, turnstile })
 */
import { offsetMinutes, zonedToUtc } from "./bookingTime.js";

/** Google lost the reply in its redirect. Safe to retry: bookings dedupe on bookingId. */
export class LostReplyError extends Error {}

/** Somebody else got the time first, or it is no longer offered. */
export class SlotTakenError extends Error {}

export function newBookingId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

export function createBookingClient({ endpoint }) {
  if (!endpoint) throw new Error("Booking endpoint is not set");

  async function getSlots() {
    const load = () => request(`${endpoint}?action=slots`, { method: "GET" });
    try {
      return await load();
    } catch (error) {
      if (!(error instanceof LostReplyError)) throw error;
      return load();
    }
  }

  async function bookCall({ turnstile, ...fields }) {
    const send = async () =>
      request(endpoint, {
        method: "POST",
        // text/plain keeps this a "simple request", so the browser skips the
        // CORS preflight that Apps Script cannot answer. The body is still JSON.
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "book",
          ...fields,
          turnstileToken: turnstile ? await turnstile.getToken() : "",
        }),
      });

    try {
      return await send();
    } catch (error) {
      if (!(error instanceof LostReplyError)) throw error;
      // Same bookingId, so a booking that already went through comes back as
      // the same answer instead of a second event.
      turnstile?.reset();
      return send();
    }
  }

  return { getSlots, bookCall };
}

/**
 * Apps Script answers through a redirect to googleusercontent.com, and about
 * one reply in fifteen gets lost on the way: the browser ends up with the
 * health check ({ service }) or a Drive error page instead. The script has
 * already run by then, so those count as lost, not failed.
 */
async function request(url, init) {
  let response;
  try {
    response = await fetch(url, { ...init, redirect: "follow" });
  } catch (error) {
    throw new LostReplyError(`Network error: ${error.message}`);
  }
  if (!response.ok) throw new LostReplyError(`HTTP ${response.status}`);

  let result;
  try {
    result = JSON.parse(await response.text());
  } catch {
    throw new LostReplyError("Reply was not JSON");
  }
  if (result?.service) throw new LostReplyError("Reply lost in redirect");
  if (!result.ok) {
    if (result.error === "taken")
      throw new SlotTakenError("That time was just booked");
    throw new Error(result.error || "Request failed");
  }
  return result;
}

/**
 * A pretend backend for building the modal before the script is deployed.
 * mode "taken" rejects the first booking, "down" fails to load times,
 * "slow" takes 8 seconds to load times.
 */
export function createStubBookingClient({ mode = "" } = {}) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const timeZone = "America/Los_Angeles";
  let rejectedOnce = false;

  return {
    async getSlots() {
      await wait(mode === "slow" ? 8000 : 600);
      if (mode === "down") throw new Error("stub: times unavailable");
      const now = Date.now();
      const today = new Date(now + offsetMinutes(now, timeZone) * 60000);
      const slots = [];
      for (let i = 0; i < 14; i++) {
        const date = new Date(
          Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate() + i
          )
        );
        if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
        for (let t = 9 * 60; t + 30 <= 17 * 60; t += 30) {
          const ms = zonedToUtc(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            Math.floor(t / 60),
            t % 60,
            timeZone
          );
          // Knock out a couple of times so the grid looks lived in.
          if (ms < now + 12 * 3600000 || (i + t) % 7 === 0) continue;
          slots.push(new Date(ms).toISOString());
        }
      }
      return { ok: true, timeZone, callMinutes: 30, bookAheadDays: 14, slots };
    },
    async bookCall({ start }) {
      await wait(900);
      if (mode === "taken" && !rejectedOnce) {
        rejectedOnce = true;
        throw new SlotTakenError("stub: taken");
      }
      return {
        ok: true,
        start,
        meetLink: "https://meet.google.com/abc-defg-hij",
      };
    },
  };
}
