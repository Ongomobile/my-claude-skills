/**
 * Time helpers for the booking modal. Plain ES module, no framework.
 * Slots arrive as ISO strings in UTC; everything shown to the visitor is in
 * their own time zone.
 */

export function visitorTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Minutes east of UTC for a time zone at a moment, e.g. -420 for PDT. */
export function offsetMinutes(ms, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(ms));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return Math.round((asUtc - Math.floor(ms / 60000) * 60000) / 60000);
}

/** Wall-clock time in a time zone to epoch ms. Month is 0-based. */
export function zonedToUtc(year, month, day, hour, minute, timeZone) {
  const guess = Date.UTC(year, month, day, hour, minute);
  const first = offsetMinutes(guess, timeZone);
  const ms = guess - first * 60000;
  const second = offsetMinutes(ms, timeZone);
  return second === first ? ms : guess - second * 60000;
}

/** "YYYY-MM-DD" for a moment, in a time zone. */
export function dayKey(ms, timeZone) {
  const local = new Date(ms + offsetMinutes(ms, timeZone) * 60000);
  return local.toISOString().slice(0, 10);
}

export function formatTime(ms, timeZone) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}

/** "Tuesday, September 22 at 10:00 AM" */
export function formatLong(iso, timeZone) {
  const ms = Date.parse(iso);
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(ms));
  return `${date} at ${formatTime(ms, timeZone)}`;
}

/** "Pacific Time", falling back to the IANA name. */
export function timeZoneLabel(timeZone) {
  try {
    const part = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longGeneric",
    })
      .formatToParts(new Date())
      .find((x) => x.type === "timeZoneName");
    return part ? part.value : timeZone;
  } catch {
    return timeZone;
  }
}

/**
 * Consecutive days from today (in the visitor's zone), each with its open
 * times. Days with nothing open are kept so the strip reads like a calendar.
 */
export function groupByDay(slots, timeZone, minDays = 14) {
  const byKey = new Map();
  for (const iso of slots) {
    const ms = Date.parse(iso);
    const key = dayKey(ms, timeZone);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ iso, label: formatTime(ms, timeZone) });
  }

  const keys = [...byKey.keys()].sort();
  const lastKey = keys[keys.length - 1] || "";
  const [y, m, d] = dayKey(Date.now(), timeZone).split("-").map(Number);
  const label = (date, options) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...options }).format(
      date
    );

  const days = [];
  for (let i = 0; i < 62; i++) {
    const date = new Date(Date.UTC(y, m - 1, d + i, 12));
    const key = date.toISOString().slice(0, 10);
    if (i >= minDays && key > lastKey) break;
    days.push({
      key,
      weekday: label(date, { weekday: "short" }),
      dayNumber: label(date, { day: "numeric" }),
      month: label(date, { month: "short" }),
      fullLabel: label(date, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
      slots: byKey.get(key) || [],
    });
  }
  return days;
}
