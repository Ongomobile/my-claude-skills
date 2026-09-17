import { ref, nextTick } from "vue";
import { BOOKING_ENDPOINT, LEGACY_BOOKING_URL } from "@/config/booking";

// One modal for the whole site. Any button calls openBooking().
const isOpen = ref(false);
let opener = null;

// Without an endpoint, dev gets the stub and production falls back to Setmore.
export const bookingLive = Boolean(BOOKING_ENDPOINT) || import.meta.env.DEV;

export function useBooking() {
  function openBooking(event) {
    if (!bookingLive) {
      if (LEGACY_BOOKING_URL) window.open(LEGACY_BOOKING_URL, "_blank", "noopener");
      return;
    }
    opener = event?.currentTarget || document.activeElement;
    isOpen.value = true;
  }

  function closeBooking() {
    isOpen.value = false;
    const returnTo = opener;
    opener = null;
    nextTick(() => returnTo?.focus?.());
  }

  return { isOpen, openBooking, closeBooking };
}
