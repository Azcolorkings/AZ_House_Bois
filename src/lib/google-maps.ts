/**
 * Google Maps address verification for booking addresses.
 *
 * The booking form autocompletes addresses against Google Places
 * (see src/components/AddressAutocomplete.tsx), and the booking API
 * re-checks the submitted address here — a typed address with no
 * place picked is geocoded, a picked place is confirmed via Place
 * Details — so a fake pasted address can't slip through.
 *
 * FAIL-SOFT like the PayPal integration: with no Google API key
 * configured, verification is skipped entirely and bookings work
 * exactly as they did before this feature existed. A Google outage
 * (fetch failure) also skips the check rather than blocking real
 * bookings — only a definite "Google can't find this" rejects.
 *
 * Keys (Vercel env vars, Production):
 * - NEXT_PUBLIC_GOOGLE_MAPS_API_KEY — browser key, for the JS API +
 *   Places autocomplete. Public by design (it ships to the browser).
 * - GOOGLE_MAPS_API_KEY — server key, for the verification calls
 *   below. Falls back to the browser key, so setting one key is
 *   enough; the two are separate so the server key can be locked
 *   down differently if wanted.
 */

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const PLACE_DETAILS_URL =
  "https://maps.googleapis.com/maps/api/place/details/json";

export function googleMapsServerKey(): string {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  );
}

export function googleMapsBrowserKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
}

export function isGoogleMapsConfigured(): boolean {
  return Boolean(googleMapsServerKey());
}

export interface VerifiedAddress {
  ok: boolean;
  /** True when the check was skipped (no key, or Google unreachable) — not a real verification. */
  skipped?: boolean;
  /** Google's canonical formatted address — store this, not the typed text. */
  formattedAddress?: string;
  placeId?: string;
  latitude?: number;
  longitude?: number;
}

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

async function fetchJson(
  url: string
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    console.error("google maps api error", err);
    return null;
  }
}

/** A real cleanable address has a street number + street name. A city, ZIP, or state alone geocodes fine but is not an address. */
function hasStreetNumber(components: unknown): boolean {
  if (!Array.isArray(components)) return false;
  const types = new Set<string>();
  for (const c of components as AddressComponent[]) {
    for (const t of c.types ?? []) types.add(t);
  }
  return types.has("street_number") && types.has("route");
}

interface GeocodeResult {
  formatted_address?: string;
  place_id?: string;
  geometry?: { location?: { lat: number; lng: number } };
  address_components?: unknown;
}

export async function verifyBookingAddress(input: {
  address: string;
  placeId?: string;
}): Promise<VerifiedAddress> {
  const key = googleMapsServerKey();
  if (!key) return { ok: true, skipped: true };

  // A place picked from the autocomplete dropdown: confirm it with
  // Place Details. If the id is stale/invalid, fall through to
  // geocoding the typed text instead of rejecting outright.
  if (input.placeId) {
    const url =
      `${PLACE_DETAILS_URL}?place_id=${encodeURIComponent(input.placeId)}` +
      `&fields=formatted_address,geometry,address_component&key=${encodeURIComponent(key)}`;
    const data = await fetchJson(url);
    if (!data) return { ok: true, skipped: true }; // Google unreachable
    if (data.status === "OK") {
      const result = data.result as GeocodeResult | undefined;
      const loc = result?.geometry?.location;
      if (
        result &&
        typeof loc?.lat === "number" &&
        typeof loc?.lng === "number"
      ) {
        return {
          ok: true,
          formattedAddress: result.formatted_address,
          placeId: input.placeId,
          latitude: loc.lat,
          longitude: loc.lng,
        };
      }
    }
  }

  // Typed address (no place picked, or the picked place didn't check
  // out): geocode it, US only.
  const url =
    `${GEOCODE_URL}?address=${encodeURIComponent(input.address)}` +
    `&components=country:US&key=${encodeURIComponent(key)}`;
  const data = await fetchJson(url);
  if (!data) return { ok: true, skipped: true }; // Google unreachable
  if (
    data.status !== "OK" ||
    !Array.isArray(data.results) ||
    data.results.length === 0
  ) {
    return { ok: false };
  }
  const first = data.results[0] as GeocodeResult;
  if (!hasStreetNumber(first.address_components)) return { ok: false };
  const loc = first.geometry?.location;
  return {
    ok: true,
    formattedAddress: first.formatted_address,
    placeId: first.place_id,
    latitude: typeof loc?.lat === "number" ? loc.lat : undefined,
    longitude: typeof loc?.lng === "number" ? loc.lng : undefined,
  };
}
