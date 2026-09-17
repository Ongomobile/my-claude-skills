<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from "vue";
import { useBooking, bookingLive } from "@/composables/useBooking";
import {
  BOOKING_ENDPOINT,
  TURNSTILE_SITE_KEY,
  FALLBACK_EMAIL,
} from "@/config/booking";
import {
  createBookingClient,
  createStubBookingClient,
  newBookingId,
  SlotTakenError,
} from "@/services/bookingApi";
import {
  visitorTimeZone,
  groupByDay,
  formatLong,
  timeZoneLabel,
} from "@/services/bookingTime";
import { createTurnstile } from "@/services/turnstile";

const props = defineProps({
  // U+2011 non-breaking hyphen keeps "30-minute" together on narrow screens.
  title: { type: String, default: "Book a free 30‑minute call" },
  subtitle: {
    type: String,
    default: "No sales pitch. No pressure. Just a friendly conversation.",
  },
  photo: { type: String, default: "" },
});

const { isOpen, closeBooking } = useBooking();

const stubMode = !BOOKING_ENDPOINT;
const client = !bookingLive
  ? null
  : stubMode
  ? createStubBookingClient({
      mode:
        new URLSearchParams(window.location.search).get("bookingStub") || "",
    })
  : createBookingClient({ endpoint: BOOKING_ENDPOINT });

const SLOTS_FRESH_MS = 60000;
const timeZone = visitorTimeZone();
const zoneLabel = timeZoneLabel(timeZone);

const step = ref("time"); // time | details | done
const slots = ref([]);
const slotsLoadedAt = ref(0);
const loading = ref(false);
const loadError = ref(false);
const selectedDayKey = ref("");
const selectedStart = ref("");
const takenNotice = ref(false);

const form = ref({
  name: "",
  email: "",
  workingOn: "",
  website: "",
  company: "",
});
const bookingId = ref("");
const submitting = ref(false);
const submitError = ref("");
const confirmed = ref(null);

const card = ref(null);
const nameInput = ref(null);
const doneHeading = ref(null);
const turnstileBox = ref(null);
let turnstile = null;

const days = computed(() => groupByDay(slots.value, timeZone));
const selectedDay = computed(
  () => days.value.find((d) => d.key === selectedDayKey.value) || null
);
const hasAnySlots = computed(() => slots.value.length > 0);
const chosenLabel = computed(() =>
  selectedStart.value ? formatLong(selectedStart.value, timeZone) : ""
);

async function loadSlots(force = false) {
  if (!client) return;
  if (!force && Date.now() - slotsLoadedAt.value < SLOTS_FRESH_MS) return;
  loading.value = true;
  loadError.value = false;
  try {
    const result = await client.getSlots();
    slots.value = result.slots || [];
    slotsLoadedAt.value = Date.now();
    const stillThere = days.value.some(
      (d) => d.key === selectedDayKey.value && d.slots.length
    );
    if (!stillThere) {
      selectedDayKey.value = days.value.find((d) => d.slots.length)?.key || "";
    }
  } catch (error) {
    console.error("[booking] Could not load times:", error);
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

function chooseSlot(iso) {
  selectedStart.value = iso;
  takenNotice.value = false;
  submitError.value = "";
  bookingId.value = newBookingId();
  step.value = "details";
}

function backToTimes() {
  step.value = "time";
}

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

const REJECTIONS = {
  "verification failed": "We couldn't check that you're a person. Try again.",
  "invalid email": "That email address doesn't look right.",
  "busy, try again shortly":
    "Lots of bookings right now. Try again in a minute.",
};

async function submit() {
  submitError.value = "";
  const fields = form.value;
  if (!fields.name.trim()) {
    submitError.value = "Add your name so I know who I'm talking to.";
    return;
  }
  if (!isValidEmail(fields.email.trim())) {
    submitError.value = "That email address doesn't look right.";
    return;
  }

  submitting.value = true;
  try {
    const result = await client.bookCall({
      name: fields.name.trim(),
      email: fields.email.trim(),
      workingOn: fields.workingOn.trim(),
      website: fields.website.trim(),
      company: fields.company,
      timeZone,
      start: selectedStart.value,
      bookingId: bookingId.value,
      turnstile,
    });
    confirmed.value = {
      firstName: fields.name.trim().split(/\s+/)[0],
      when: formatLong(result.start || selectedStart.value, timeZone),
    };
    form.value = {
      name: "",
      email: "",
      workingOn: "",
      website: "",
      company: "",
    };
    slotsLoadedAt.value = 0;
    step.value = "done";
  } catch (error) {
    if (error instanceof SlotTakenError) {
      takenNotice.value = true;
      selectedStart.value = "";
      step.value = "time";
      loadSlots(true);
    } else {
      console.error("[booking] Booking failed:", error);
      submitError.value =
        REJECTIONS[error.message] ||
        "Something went wrong booking your call. Try again.";
      turnstile?.reset();
    }
  } finally {
    submitting.value = false;
  }
}

function close() {
  if (submitting.value) return;
  closeBooking();
}

// ── Open / close ──
watch(isOpen, async (open) => {
  const html = document.documentElement;
  if (open) {
    // Every visit starts at the calendar. Anything typed into the form stays.
    step.value = "time";
    confirmed.value = null;
    takenNotice.value = false;
    const scrollbar = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
    loadSlots();
    await nextTick();
    card.value?.focus();
  } else {
    html.style.overflow = "";
    document.body.style.paddingRight = "";
    removeTurnstile();
  }
});

// Move focus with the step, and start the bot check when the form shows.
watch(step, async (value) => {
  await nextTick();
  if (value === "details") {
    nameInput.value?.focus();
    mountTurnstile();
  } else {
    removeTurnstile();
    if (value === "done") doneHeading.value?.focus();
  }
});

async function mountTurnstile() {
  if (stubMode || !TURNSTILE_SITE_KEY || turnstile || !turnstileBox.value)
    return;
  try {
    turnstile = await createTurnstile(turnstileBox.value, TURNSTILE_SITE_KEY);
  } catch (error) {
    console.error("[booking] Turnstile did not load:", error);
  }
}

function removeTurnstile() {
  turnstile?.remove();
  turnstile = null;
}

onBeforeUnmount(() => {
  removeTurnstile();
  document.documentElement.style.overflow = "";
  document.body.style.paddingRight = "";
});

// Keep Tab inside the dialog; Esc closes it.
function onKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    return;
  }
  if (event.key !== "Tab" || !card.value) return;
  const focusable = [
    ...card.value.querySelectorAll(
      'button:not([disabled]), a[href], input:not([tabindex="-1"]), textarea, [tabindex]:not([tabindex="-1"])'
    ),
  ].filter((el) => el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (
    event.shiftKey &&
    (document.activeElement === first || document.activeElement === card.value)
  ) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="bk" :duration="{ enter: 380, leave: 220 }">
      <div v-if="isOpen" class="bk-root" @keydown="onKeydown">
        <div class="bk-backdrop" @click="close"></div>

        <div
          ref="card"
          class="bk-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bk-title"
          tabindex="-1"
        >
          <button
            type="button"
            class="bk-close"
            aria-label="Close"
            @click="close"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>

          <header class="bk-head">
            <img
              v-if="props.photo"
              :src="props.photo"
              alt=""
              class="bk-photo"
              width="96"
              height="96"
            />
            <div>
              <h2 id="bk-title" class="bk-title">{{ props.title }}</h2>
              <p class="bk-subtitle">{{ props.subtitle }}</p>
            </div>
          </header>

          <div class="bk-body">
            <!-- Step 1: pick a time -->
            <section v-if="step === 'time'">
              <p class="bk-step">// step 1 of 2: pick a time</p>
              <p v-if="takenNotice" class="bk-notice" role="status">
                That time just got booked. Pick another.
              </p>

              <div
                v-if="loading && !hasAnySlots"
                class="bk-skeleton"
                aria-label="Loading open times"
              >
                <span v-for="n in 14" :key="n" class="bk-skel-day"></span>
              </div>

              <div v-else-if="loadError" class="bk-error" role="alert">
                <p>Can't load open times right now.</p>
                <p class="bk-error-actions">
                  <button
                    type="button"
                    class="bk-link"
                    @click="loadSlots(true)"
                  >
                    Try again
                  </button>
                  <template v-if="FALLBACK_EMAIL">
                    or email me at
                    <a class="bk-link" :href="`mailto:${FALLBACK_EMAIL}`">{{
                      FALLBACK_EMAIL
                    }}</a>
                  </template>
                </p>
              </div>

              <div v-else-if="!hasAnySlots" class="bk-empty">
                <p>No open times in the next two weeks. Check back soon.</p>
                <p v-if="FALLBACK_EMAIL">
                  Or email me at
                  <a class="bk-link" :href="`mailto:${FALLBACK_EMAIL}`">{{
                    FALLBACK_EMAIL
                  }}</a>
                </p>
              </div>

              <template v-else>
                <h3 class="bk-label">Pick a day</h3>
                <div class="bk-days">
                  <button
                    v-for="day in days"
                    :key="day.key"
                    type="button"
                    class="bk-day"
                    :disabled="!day.slots.length"
                    :aria-pressed="
                      selectedDayKey === day.key ? 'true' : 'false'
                    "
                    :aria-label="`${day.fullLabel}, ${day.slots.length} open times`"
                    @click="selectedDayKey = day.key"
                  >
                    <span class="bk-day-week">{{ day.weekday }}</span>
                    <span class="bk-day-num">{{ day.dayNumber }}</span>
                    <span class="bk-day-month">{{ day.month }}</span>
                  </button>
                </div>

                <template v-if="selectedDay">
                  <h3 class="bk-label">{{ selectedDay.fullLabel }}</h3>
                  <div class="bk-times">
                    <button
                      v-for="slot in selectedDay.slots"
                      :key="slot.iso"
                      type="button"
                      class="bk-time"
                      @click="chooseSlot(slot.iso)"
                    >
                      {{ slot.label }}
                    </button>
                  </div>
                </template>

                <p class="bk-hint">
                  // times shown in your time zone ({{ zoneLabel }})
                </p>
              </template>
            </section>

            <!-- Step 2: details -->
            <form
              v-else-if="step === 'details'"
              novalidate
              @submit.prevent="submit"
            >
              <p class="bk-step">// step 2 of 2: your details</p>

              <div class="bk-chosen">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect width="18" height="18" x="3" y="4" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                <strong>{{ chosenLabel }}</strong>
                <button type="button" class="bk-link" @click="backToTimes">
                  Change
                </button>
              </div>

              <div class="bk-field">
                <label for="bk-name">Your name</label>
                <input
                  id="bk-name"
                  ref="nameInput"
                  v-model="form.name"
                  type="text"
                  autocomplete="name"
                  maxlength="80"
                  required
                />
              </div>
              <div class="bk-field">
                <label for="bk-email">Email</label>
                <input
                  id="bk-email"
                  v-model="form.email"
                  type="email"
                  autocomplete="email"
                  maxlength="254"
                  required
                />
                <span class="bk-field-note"
                  >The calendar invite goes here.</span
                >
              </div>
              <div class="bk-field">
                <label for="bk-working-on">What are you working on?</label>
                <textarea
                  id="bk-working-on"
                  v-model="form.workingOn"
                  rows="3"
                  maxlength="1000"
                ></textarea>
              </div>
              <div class="bk-field">
                <label for="bk-website"
                  >Website <span class="bk-optional">(optional)</span></label
                >
                <input
                  id="bk-website"
                  v-model="form.website"
                  type="text"
                  inputmode="url"
                  autocomplete="url"
                  maxlength="200"
                />
              </div>

              <!-- Honeypot: hidden from people, filled by bots -->
              <div class="bk-hp" aria-hidden="true">
                <label for="bk-company">Company</label>
                <input
                  id="bk-company"
                  v-model="form.company"
                  type="text"
                  tabindex="-1"
                  autocomplete="off"
                />
              </div>

              <div ref="turnstileBox" class="bk-turnstile"></div>

              <p
                v-if="submitError"
                class="bk-error bk-error-inline"
                role="alert"
              >
                {{ submitError }}
              </p>

              <button type="submit" class="bk-btn" :disabled="submitting">
                {{ submitting ? "Booking your call..." : "Book my call" }}
              </button>
              <p v-if="stubMode" class="bk-hint">
                // demo mode. nothing is booked.
              </p>
            </form>

            <!-- Step 3: done -->
            <section v-else class="bk-done">
              <span class="bk-stamp">Booked</span>
              <h3 ref="doneHeading" class="bk-done-title" tabindex="-1">
                You're booked, {{ confirmed?.firstName }}.
              </h3>
              <p class="bk-done-when">{{ confirmed?.when }}</p>
              <p class="bk-done-note">
                Check your inbox for the Google Calendar invite with your Meet
                link.
              </p>
              <button
                type="button"
                class="bk-btn bk-btn-secondary"
                @click="close"
              >
                Done
              </button>
            </section>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Theme: swap these to re-skin the modal for another brand. */
.bk-root {
  --bk-surface: var(--paper);
  --bk-field: var(--canvas);
  --bk-soft: var(--canvas-warm);
  --bk-ink: var(--ink);
  --bk-ink-soft: var(--graphite);
  --bk-muted: var(--pencil);
  --bk-line: var(--tape);
  --bk-accent: var(--orange);
  --bk-accent-press: var(--orange-deep);
  --bk-accent-ink: var(--ink);
  --bk-accent-text: var(--orange-text);
  --bk-highlight: var(--tape-yellow);
  --bk-error: var(--stamp);
  --bk-focus: var(--blueprint);
  --bk-radius: 14px;
  --bk-radius-sm: 4px;
  --bk-border: 1.5px solid var(--bk-ink);
  --bk-shadow: 8px 8px 0 var(--bk-ink);
  --bk-shadow-sm: 3px 3px 0 var(--bk-ink);
  --bk-font-display: var(--font-display);
  --bk-font-body: var(--font-body);
  --bk-font-mono: var(--font-mono);
  --bk-ease: cubic-bezier(0.22, 1, 0.36, 1);

  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  font-family: var(--bk-font-body);
  color: var(--bk-ink);
}

.bk-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(26, 23, 20, 0.55);
  backdrop-filter: blur(6px);
}

.bk-card {
  position: relative;
  width: 100%;
  max-width: 600px;
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--bk-surface);
  border: var(--bk-border);
  border-radius: var(--bk-radius);
  box-shadow: var(--bk-shadow);
}
.bk-card:focus {
  outline: none;
}

button:focus-visible,
a:focus-visible,
input:focus-visible,
textarea:focus-visible,
.bk-done-title:focus-visible {
  outline: 2px solid var(--bk-focus);
  outline-offset: 2px;
}

/* ── Header ── */
.bk-close {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--bk-surface);
  border: var(--bk-border);
  border-radius: var(--bk-radius-sm);
  box-shadow: var(--bk-shadow-sm);
  transition: transform 110ms ease-out, box-shadow 110ms ease-out;
}
.bk-close:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--bk-ink);
}
.bk-close:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 var(--bk-ink);
}
.bk-close svg,
.bk-chosen svg {
  width: 20px;
  height: 20px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.bk-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 28px 72px 22px 28px;
  border-bottom: 1.5px solid var(--bk-line);
}
.bk-photo {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 999px;
  border: var(--bk-border);
  box-shadow: var(--bk-shadow-sm);
  object-fit: cover;
  transform: rotate(-4deg);
}
.bk-title {
  font-family: var(--bk-font-display);
  font-weight: 800;
  font-size: 26px;
  line-height: 1.1;
  letter-spacing: -0.025em;
  text-wrap: balance;
}
.bk-subtitle {
  margin-top: 6px;
  font-size: 15px;
  color: var(--bk-ink-soft);
}

/* ── Body ── */
.bk-body {
  padding: 22px 28px 28px;
}
.bk-step {
  font-family: var(--bk-font-mono);
  font-size: 13px;
  color: var(--bk-muted);
}
.bk-label {
  margin: 20px 0 10px;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--bk-accent-text);
}
.bk-hint {
  margin-top: 16px;
  font-family: var(--bk-font-mono);
  font-size: 13px;
  color: var(--bk-muted);
}
.bk-notice {
  margin-top: 14px;
  padding: 10px 14px;
  font-weight: 600;
  background: var(--bk-highlight);
  border-radius: var(--bk-radius-sm);
}
.bk-link {
  font-weight: 600;
  color: var(--bk-accent-text);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.bk-link:hover {
  text-decoration-thickness: 2px;
}

/* Days: two rows of seven on wider screens, a swipeable strip on phones */
.bk-days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}
.bk-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 8px 2px;
  background: var(--bk-surface);
  border: var(--bk-border);
  border-radius: 8px;
  transition: transform 110ms ease-out, box-shadow 110ms ease-out,
    background-color 110ms ease-out;
}
.bk-day:not([disabled]):hover {
  transform: translate(-1px, -1px);
  box-shadow: var(--bk-shadow-sm);
}
.bk-day[aria-pressed="true"] {
  background: var(--bk-accent);
  color: var(--bk-accent-ink);
  box-shadow: var(--bk-shadow-sm);
}
.bk-day[disabled] {
  border-color: var(--bk-line);
  color: var(--bk-muted);
  opacity: 0.55;
  cursor: default;
}
.bk-day-week,
.bk-day-month {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.bk-day-num {
  font-family: var(--bk-font-display);
  font-weight: 800;
  font-size: 20px;
  line-height: 1.1;
}

.bk-times {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 8px;
}
.bk-time {
  padding: 10px 8px;
  font-weight: 600;
  font-size: 15px;
  background: var(--bk-surface);
  border: var(--bk-border);
  border-radius: var(--bk-radius-sm);
  transition: transform 110ms ease-out, box-shadow 110ms ease-out,
    background-color 110ms ease-out;
}
.bk-time:hover {
  background: var(--bk-soft);
  transform: translate(-1px, -1px);
  box-shadow: var(--bk-shadow-sm);
}
.bk-time:active {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 var(--bk-ink);
}

.bk-skeleton {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  margin-top: 20px;
}
.bk-skel-day {
  height: 68px;
  border-radius: 8px;
  background: var(--bk-soft);
  animation: bk-pulse 1.2s ease-in-out infinite alternate;
}
@keyframes bk-pulse {
  from {
    opacity: 0.5;
  }
  to {
    opacity: 1;
  }
}

.bk-error,
.bk-empty {
  margin-top: 18px;
  padding: 14px 16px;
  border: 1.5px solid var(--bk-line);
  border-radius: 8px;
  background: var(--bk-field);
}
.bk-error {
  border-color: var(--bk-error);
}
.bk-error-actions {
  margin-top: 6px;
}
.bk-error-inline {
  margin-top: 16px;
  padding: 10px 14px;
  color: var(--bk-error);
  font-weight: 600;
}

/* ── Details form ── */
.bk-chosen {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 0 6px;
  padding: 12px 14px;
  background: var(--bk-soft);
  border: var(--bk-border);
  border-radius: 8px;
}
.bk-chosen strong {
  font-size: 15px;
}
.bk-chosen .bk-link {
  margin-left: auto;
}

.bk-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 16px;
}
.bk-field label {
  font-size: 14px;
  font-weight: 600;
}
.bk-optional {
  font-weight: 400;
  color: var(--bk-muted);
}
.bk-field input,
.bk-field textarea {
  width: 100%;
  padding: 11px 14px;
  font: inherit;
  font-size: 16px; /* 16px stops iOS zooming into the field */
  color: var(--bk-ink);
  background: var(--bk-field);
  border: var(--bk-border);
  border-radius: var(--bk-radius-sm);
  resize: vertical;
}
.bk-field-note {
  font-size: 13px;
  color: var(--bk-muted);
}
.bk-hp {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
.bk-turnstile:not(:empty) {
  margin-top: 16px;
}

.bk-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-top: 20px;
  padding: 14px 20px;
  font-family: var(--bk-font-display);
  font-weight: 700;
  font-size: 15px;
  text-transform: uppercase;
  color: var(--bk-accent-ink);
  background: var(--bk-accent);
  border-radius: var(--bk-radius-sm);
  box-shadow: var(--bk-shadow-sm);
  transition: transform 110ms ease-out, box-shadow 110ms ease-out,
    background-color 110ms ease-out;
}
.bk-btn:hover:not([disabled]) {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0 var(--bk-ink);
}
.bk-btn:active:not([disabled]) {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 var(--bk-ink);
  background: var(--bk-accent-press);
}
.bk-btn[disabled] {
  opacity: 0.7;
  cursor: progress;
}
.bk-btn-secondary {
  width: auto;
  margin: 24px auto 0;
  padding: 12px 32px;
  background: var(--bk-surface);
  border: var(--bk-border);
}

/* ── Done ── */
.bk-done {
  padding: 12px 0 4px;
  text-align: center;
}
.bk-stamp {
  display: inline-block;
  padding: 6px 12px;
  font-family: var(--bk-font-display);
  font-weight: 800;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--bk-error);
  border: 2px solid var(--bk-error);
  border-radius: 2px;
  transform: rotate(-6deg);
}
.bk-done-title {
  margin-top: 18px;
  font-family: var(--bk-font-display);
  font-weight: 800;
  font-size: 28px;
  letter-spacing: -0.025em;
}
.bk-done-when {
  margin-top: 8px;
  font-size: 18px;
  font-weight: 600;
}
.bk-done-note {
  margin: 10px auto 0;
  max-width: 380px;
  color: var(--bk-ink-soft);
}

/* ── Enter / leave ── */
.bk-enter-active .bk-backdrop,
.bk-leave-active .bk-backdrop {
  transition: opacity 0.3s ease;
}
.bk-enter-from .bk-backdrop,
.bk-leave-to .bk-backdrop {
  opacity: 0;
}
.bk-enter-active .bk-card {
  transition: transform 0.38s var(--bk-ease), opacity 0.3s ease;
}
.bk-leave-active .bk-card {
  transition: transform 0.22s ease, opacity 0.2s ease;
}
.bk-enter-from .bk-card,
.bk-leave-to .bk-card {
  opacity: 0;
  transform: translateY(24px) scale(0.96);
}

/* ── Phones: a full-height sheet ── */
@media (max-width: 639px) {
  .bk-root {
    padding: 0;
    align-items: flex-end;
  }
  .bk-card {
    max-width: none;
    max-height: 100dvh;
    height: 100dvh;
    border-radius: var(--bk-radius) var(--bk-radius) 0 0;
    border-bottom: 0;
    box-shadow: none;
  }
  .bk-head {
    padding: 20px 68px 18px 20px;
  }
  .bk-photo {
    width: 52px;
    height: 52px;
  }
  .bk-title {
    font-size: 22px;
  }
  .bk-body {
    padding: 18px 20px 28px;
  }
  .bk-days {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x proximity;
    padding: 2px 4px 6px 2px;
    margin: 0 -4px;
  }
  .bk-day {
    flex: 0 0 60px;
    scroll-snap-align: start;
  }
  .bk-skeleton {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .bk-enter-from .bk-card,
  .bk-leave-to .bk-card {
    transform: translateY(48px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bk-enter-active .bk-backdrop,
  .bk-leave-active .bk-backdrop,
  .bk-enter-active .bk-card,
  .bk-leave-active .bk-card,
  .bk-day,
  .bk-time,
  .bk-btn,
  .bk-close {
    transition: none;
  }
  .bk-skel-day {
    animation: none;
  }
}
</style>
