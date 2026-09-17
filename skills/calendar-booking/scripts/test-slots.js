#!/usr/bin/env node
/* eslint-env node */
/**
 * Checks the slot rules in apps-script/Slots.gs without Google: hours, the gap
 * around busy times, minimum notice, days off, closed weekends, the book-ahead
 * limit, split hours, and a daylight saving change.
 *
 *   node test-slots.js [apps-script folder]
 *
 * With no folder it tests the skill's own templates/apps-script/Slots.gs.
 *
 * Exit code 0 means every check passed.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const dir = process.argv[2] || path.join(__dirname, "..", "templates", "apps-script");
const source = fs.readFileSync(path.join(dir, "Slots.gs"), "utf8");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(source, ctx);
const { buildSlots, parseClock, parseHours, parseDateKey } = ctx;

let failures = 0;
const ok = (name, cond, detail) => {
  console.log(
    (cond ? "PASS " : "FAIL ") +
      name +
      (cond || !detail ? "" : "  -> " + detail)
  );
  if (!cond) failures++;
};

// Same contract as tzOffsetMinutes in Code.gs, built on Intl.
function offsetMinutes(ms, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(ms));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return Math.round(
    (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) -
      Math.floor(ms / 60000) * 60000) /
      60000
  );
}

const TZ = "America/Los_Angeles";
const settings = {
  timeZone: TZ,
  callMinutes: 30,
  gapMinutes: 30,
  stepMinutes: 30,
  noticeHours: 12,
  bookAheadDays: 14,
};
const weekdays = parseHours([
  ["Monday", "9:00 AM", "5:00 PM"],
  ["Tuesday", "9:00 AM", "5:00 PM"],
  ["Wednesday", "9:00 AM", "5:00 PM"],
  ["Thursday", "9:00 AM", "5:00 PM"],
  ["Friday", "9:00 AM", "5:00 PM"],
  ["Saturday", "", ""],
  ["Sunday", "", ""],
]);

// Pacific wall time to ms. Month is 1-based here for readability.
const pt = (y, mo, d, h, mi = 0) => {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  return (
    guess - offsetMinutes(guess - offsetMinutes(guess, TZ) * 60000, TZ) * 60000
  );
};
const iso = (ms) => new Date(ms).toISOString();
const run = (over = {}) =>
  buildSlots({
    settings: { ...settings, ...(over.settings || {}) },
    hours: over.hours || weekdays,
    daysOff: over.daysOff || [],
    busy: over.busy || [],
    nowMs: over.nowMs,
    offsetMinutes,
  });
const onDay = (slots, y, mo, d) =>
  slots.filter((s) => {
    const ms = new Date(s).getTime();
    return ms >= pt(y, mo, d, 0) && ms < pt(y, mo, d + 1, 0);
  });

// Sunday Sep 20 2026, 8am PT. Monday Sep 21 is fully bookable.
const sundayMorning = pt(2026, 9, 20, 8);

// --- parsing ---------------------------------------------------------------
ok("parseClock 9:00 AM", parseClock("9:00 AM") === 540);
ok("parseClock 5:00 PM", parseClock("5:00 PM") === 1020);
ok("parseClock 17:00", parseClock("17:00") === 1020);
ok("parseClock 12:00 PM is noon", parseClock("12:00 PM") === 720);
ok("parseClock 12:00 AM is midnight", parseClock("12:00 AM") === 0);
ok("parseClock 9 am", parseClock("9 am") === 540);
ok("parseClock 9:00:00", parseClock("9:00:00") === 540);
ok(
  "parseClock rejects junk",
  parseClock("soon") === null &&
    parseClock("") === null &&
    parseClock("13 PM") === null
);
ok(
  "parseHours skips blank Saturday",
  !weekdays[6] && !weekdays[0] && weekdays[1].length === 1
);
ok("parseDateKey ISO", parseDateKey("2026-10-5") === "2026-10-05");
ok("parseDateKey US", parseDateKey("10/5/2026") === "2026-10-05");
ok("parseDateKey junk", parseDateKey("next week") === null);

// --- a full day ------------------------------------------------------------
{
  const monday = onDay(run({ nowMs: sundayMorning }), 2026, 9, 21);
  ok(
    "Monday has 16 starts (9:00 to 4:30)",
    monday.length === 16,
    monday.length
  );
  ok(
    "first start is 9:00 PT (16:00 UTC in PDT)",
    monday[0] === iso(pt(2026, 9, 21, 9)),
    monday[0]
  );
  ok(
    "last start is 4:30 PT",
    monday[monday.length - 1] === iso(pt(2026, 9, 21, 16, 30)),
    monday[monday.length - 1]
  );
}

// --- weekends closed -------------------------------------------------------
{
  const slots = run({ nowMs: sundayMorning });
  ok(
    "no Saturday or Sunday starts",
    onDay(slots, 2026, 9, 26).length === 0 &&
      onDay(slots, 2026, 9, 27).length === 0
  );
}

// --- 30 minute gap around a booked call --------------------------------------
{
  const busy = [{ start: pt(2026, 9, 21, 10), end: pt(2026, 9, 21, 10, 30) }];
  const monday = onDay(run({ nowMs: sundayMorning, busy }), 2026, 9, 21);
  const has = (h, m) => monday.includes(iso(pt(2026, 9, 21, h, m)));
  ok("9:00 still open (ends 30 min before)", has(9, 0));
  ok("9:30 blocked (no gap)", !has(9, 30));
  ok("10:00 blocked (busy)", !has(10, 0));
  ok("10:30 blocked (no gap)", !has(10, 30));
  ok("11:00 open (30 min after)", has(11, 0));
}

// --- minimum notice ----------------------------------------------------------
{
  // Monday 10pm PT with 12 hours notice: nothing before Tuesday 10am.
  const slots = run({ nowMs: pt(2026, 9, 21, 22) });
  const tuesday = onDay(slots, 2026, 9, 22);
  ok(
    "notice drops Tuesday 9:00 and 9:30",
    !tuesday.includes(iso(pt(2026, 9, 22, 9))) &&
      !tuesday.includes(iso(pt(2026, 9, 22, 9, 30)))
  );
  ok(
    "notice keeps Tuesday 10:00",
    tuesday[0] === iso(pt(2026, 9, 22, 10)),
    tuesday[0]
  );
}

// --- days off ------------------------------------------------------------------
{
  const slots = run({ nowMs: sundayMorning, daysOff: ["2026-09-23"] });
  ok("day off Wednesday has no starts", onDay(slots, 2026, 9, 23).length === 0);
  ok("Thursday still open", onDay(slots, 2026, 9, 24).length === 16);
}

// --- book ahead ------------------------------------------------------------------
{
  const slots = run({ nowMs: sundayMorning, settings: { bookAheadDays: 3 } });
  // Days counted from Sunday: Sun, Mon, Tue. Wednesday is out.
  ok(
    "book ahead 3 days stops after Tuesday",
    onDay(slots, 2026, 9, 22).length === 16 &&
      onDay(slots, 2026, 9, 23).length === 0
  );
}

// --- split hours -----------------------------------------------------------------
{
  const hours = parseHours([
    ["Mon", "9:00 AM", "12:00 PM"],
    ["Mon", "1:00 PM", "5:00 PM"],
  ]);
  const monday = onDay(run({ nowMs: sundayMorning, hours }), 2026, 9, 21);
  ok(
    "lunch break has no 12:00 or 12:30",
    !monday.includes(iso(pt(2026, 9, 21, 12))) &&
      !monday.includes(iso(pt(2026, 9, 21, 12, 30)))
  );
  ok("split day has 14 starts", monday.length === 14, monday.length);
}

// --- daylight saving ends Nov 1 2026 ---------------------------------------------
{
  const slots = run({ nowMs: pt(2026, 10, 25, 8) });
  const before = onDay(slots, 2026, 10, 26)[0];
  const after = onDay(slots, 2026, 11, 2)[0];
  ok(
    "Mon Oct 26 9:00 PT is 16:00 UTC",
    before === "2026-10-26T16:00:00.000Z",
    before
  );
  ok(
    "Mon Nov 2 9:00 PT is 17:00 UTC",
    after === "2026-11-02T17:00:00.000Z",
    after
  );
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
