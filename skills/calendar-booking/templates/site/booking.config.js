/**
 * Booking settings for this site. None of these are secrets: the Web App URL
 * and the Turnstile site key are public by design. The Turnstile SECRET key
 * lives only in the Apps Script's Script Properties.
 *
 * Save as src/config/booking.js (or wherever the site keeps config).
 */

// Apps Script Web App URL, ends in /exec. Empty = stub mode in local dev.
export const BOOKING_ENDPOINT = "";

// Cloudflare Turnstile site key. The widget's hostnames must include every
// domain the modal runs on (apex, www, and any preview domain used for tests).
export const TURNSTILE_SITE_KEY = "";

// Shown if open times can't load. Visible on the site. Empty hides the line.
export const FALLBACK_EMAIL = "";

// Optional: the booking tool being replaced (Setmore, Calendly...). Until
// BOOKING_ENDPOINT is set, production buttons open this instead of a modal
// with no calendar behind it. Delete once the live test passes.
export const LEGACY_BOOKING_URL = "";
