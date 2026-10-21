/**
 * Placeholder copy for the Pre-owned pages, taken from the design mockups.
 * TODO(Panda): confirm or rewrite every string marked TODO below before launch —
 * these are promises to customers (reservation window, inspection scope, payment).
 */
export const PREOWNED_COPY = {
  intro:
    "Every bike is checked, battery-tested and photographed before it is listed. Guide prices, honest grades, no surprises at viewing.",
  proof: [
    { label: "Battery", text: "Health-tested on every bike" },
    { label: "Photos", text: "Real and unedited" },
    { label: "Viewing", text: "By appointment" },
  ],
  viewing: {
    title: "Viewing by appointment",
    // TODO(Panda): confirm test rides and UK delivery are offered.
    text: "Test ride when you view. UK delivery on request.",
  },
  // TODO(Panda): confirm the inspection really is a 32-point check (or change the label).
  inspectionLabel: "32-point check",
  howBuying: [
    { title: "Enquire or WhatsApp", text: "We confirm it's still here and hold it for 24 hours." },
    // TODO(Panda): confirm viewing hours.
    { title: "View and test ride", text: "By appointment. Weekdays and Saturday mornings." },
    // TODO(Panda): confirm accepted payment methods and delivery terms.
    { title: "Pay and ride away", text: "Card or bank transfer. UK delivery quoted separately." },
  ],
  sell: {
    title: "Selling or part-exchanging?",
    // TODO(Panda): confirm the "within a working day" turnaround.
    text: "Send us a few photos and the mileage. We'll give you a guide figure within a working day.",
  },
  soldNote: "Similar bikes arrive most weeks.",
  // TODO(Panda): confirm UK delivery is offered on pre-owned bikes.
  cardDelivery: "Collect or UK delivery",
} as const;
