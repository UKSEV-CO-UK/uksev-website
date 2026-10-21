/**
 * Copy for the Pre-owned pages, confirmed by Panda on 2026-10-21.
 * These are promises to customers (reservation window, inspection scope, payment): change only with Panda's OK.
 */
export const PREOWNED_COPY = {
  intro:
    "Every bike is inspected and battery-tested before it's listed. Real photos, no retouching.",
  proof: [
    { label: "Battery", text: "Health-tested on every bike" },
    { label: "Photos", text: "Real and unedited" },
    { label: "Viewing", text: "By appointment" },
  ],
  viewing: {
    title: "Viewing by appointment",
    text: "Test ride when you view. UK delivery on request.",
  },
  inspectionLabel: "32-point check",
  howBuying: [
    { title: "Enquire or WhatsApp", text: "We confirm it's still here. Held for 24 hours after your enquiry." },
    { title: "View and test ride", text: "By appointment. Weekdays and Saturday mornings." },
    { title: "Pay and ride away", text: "Card or bank transfer. UK delivery quoted separately." },
  ],
  sell: {
    title: "Selling or part-exchanging?",
    text: "Send us a few photos and the mileage. We'll give you a guide figure within a working day.",
  },
  soldNote: "Similar bikes arrive most weeks.",
  cardDelivery: "Collect or UK delivery",
} as const;
