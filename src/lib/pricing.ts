/**
 * Cleaning prices — the single source of truth for what a clean costs.
 * Flat rates (Nov 21, 2026, set by Steven): same price no matter the
 * house size or how often they book. All amounts are in cents.
 * Every other part of the app must read prices from here — never
 * hard-code a cleaning price anywhere else, and never trust a
 * client-sent amount: /api/bookings re-derives the price from this file.
 */

export type ServiceKey = "regular" | "deep" | "moveout";

export type FrequencyKey =
  | "one-time"
  | "weekly"
  | "every-2-weeks"
  | "monthly";

export const CLEANING_PRICES: Record<ServiceKey, number> = {
  regular: 18000, // $180
  deep: 35000, // $350
  moveout: 45000, // $450
};

export const SERVICE_LABELS: Record<ServiceKey, string> = {
  regular: "Regular clean",
  deep: "Deep clean",
  moveout: "Move-in / move-out",
};

export const SERVICE_KEYS: ServiceKey[] = ["regular", "deep", "moveout"];

export const FREQUENCY_LABELS: Record<FrequencyKey, string> = {
  "one-time": "One-time",
  weekly: "Weekly",
  "every-2-weeks": "Every 2 weeks",
  monthly: "Monthly",
};

export const FREQUENCY_KEYS: FrequencyKey[] = [
  "one-time",
  "weekly",
  "every-2-weeks",
  "monthly",
];

/** Time slots a homeowner can pick when booking. */
export const TIME_SLOTS = [
  { value: "08:00", label: "8:00 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "12:00", label: "12:00 PM" },
  { value: "14:00", label: "2:00 PM" },
  { value: "16:00", label: "4:00 PM" },
] as const;

export function isServiceKey(value: unknown): value is ServiceKey {
  return (
    typeof value === "string" &&
    (SERVICE_KEYS as string[]).includes(value)
  );
}

export function isFrequencyKey(value: unknown): value is FrequencyKey {
  return (
    typeof value === "string" &&
    (FREQUENCY_KEYS as string[]).includes(value)
  );
}

export function isTimeSlot(value: unknown): value is string {
  return (
    typeof value === "string" &&
    TIME_SLOTS.some((s) => s.value === value)
  );
}

/** Price in cents for a service. Throws for an unknown service key. */
export function priceForService(service: ServiceKey): number {
  const price = CLEANING_PRICES[service];
  if (typeof price !== "number") throw new Error(`Unknown service: ${service}`);
  return price;
}

/**
 * The 20/80 pay split on a cleaning fee (Nov 21, 2026, set by Steven):
 * AZ House Bois keeps 20%, the cleaner gets 80%, paid biweekly after
 * the company gets paid. Regular $180 → $36 / $144; Deep $350 → $70 /
 * $280; Move-in/out $450 → $90 / $360. The cleaner's share is derived
 * as total minus the company's share so the two always add up exactly.
 */
export function splitAmount(service: ServiceKey): {
  company: number;
  cleaner: number;
} {
  const total = priceForService(service);
  const company = Math.round(total * 0.2);
  return { company, cleaner: total - company };
}

export function serviceLabel(service: ServiceKey): string {
  return SERVICE_LABELS[service] ?? service;
}

export function frequencyLabel(frequency: FrequencyKey): string {
  return FREQUENCY_LABELS[frequency] ?? frequency;
}

export function timeSlotLabel(value: string): string {
  return TIME_SLOTS.find((s) => s.value === value)?.label ?? value;
}

/** 18000 -> "$180". Amounts are always whole dollars for cleaning. */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}
