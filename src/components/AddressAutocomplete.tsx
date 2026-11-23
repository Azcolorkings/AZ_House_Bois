"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Address input with Google Maps Places autocomplete — booking form
 * only (the boi application form keeps its plain address field).
 *
 * As the homeowner types, Google suggests real US addresses in a
 * dropdown under the field. Picking one fills the field with Google's
 * formatted address and captures the place id + coordinates; a small
 * map with a pin appears under the field showing the picked spot.
 *
 * FAIL-SOFT: the config is fetched from /api/google-maps/config and
 * the Maps script only loads when a browser key exists. With no key
 * (or if the script fails to load) this renders a plain text input
 * identical to the one it replaced — the booking form works exactly
 * as it did before. Typing after a pick clears the picked place, so
 * a pasted fake address can't ride on an old pick — the server
 * re-checks the typed text on submit (see src/lib/google-maps.ts).
 */

// Minimal shapes for the parts of the Google Maps JS API we use, so
// this needs no @types/google.maps dependency. The script is loaded
// at runtime only when a browser key is configured.
interface GoogleLatLngLiteral {
  lat: number;
  lng: number;
}

interface GooglePlaceResult {
  place_id?: string;
  formatted_address?: string;
  geometry?: { location?: { lat(): number; lng(): number } };
}

interface GoogleAutocomplete {
  addListener(event: "place_changed", handler: () => void): void;
  getPlace(): GooglePlaceResult;
  setBounds(bounds: unknown): void;
}

interface GoogleMap {
  setCenter(center: GoogleLatLngLiteral): void;
}

interface GoogleMarker {
  setPosition(position: GoogleLatLngLiteral): void;
  setMap(map: GoogleMap | null): void;
}

interface GoogleMapsNamespace {
  Map: new (
    el: HTMLElement,
    opts: {
      center: GoogleLatLngLiteral;
      zoom: number;
      disableDefaultUI: boolean;
      gestureHandling?: string;
    }
  ) => GoogleMap;
  Marker: new (opts: {
    position: GoogleLatLngLiteral;
    map: GoogleMap;
  }) => GoogleMarker;
  LatLngBounds: new (
    sw: GoogleLatLngLiteral,
    ne: GoogleLatLngLiteral
  ) => unknown;
  places: {
    Autocomplete: new (
      input: HTMLInputElement,
      opts: {
        types: string[];
        componentRestrictions: { country: string };
        fields: string[];
      }
    ) => GoogleAutocomplete;
  };
}

declare global {
  interface Window {
    google?: { maps: GoogleMapsNamespace };
  }
}

export interface PickedPlace {
  placeId: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  id: string;
  value: string;
  onChange: (value: string, place?: PickedPlace) => void;
  required?: boolean;
  placeholder?: string;
}

// Rough Arizona bounding box — biases suggestions toward Arizona
// (a bias, not a hard fence; the US country restriction does the
// hard filtering).
const ARIZONA_BOUNDS_SW = { lat: 31.33, lng: -114.81 };
const ARIZONA_BOUNDS_NE = { lat: 37.0, lng: -109.05 };

let mapsScriptPromise: Promise<boolean> | null = null;

function loadGoogleMaps(apiKey: string): Promise<boolean> {
  if (typeof window !== "undefined" && window.google?.maps?.places) {
    return Promise.resolve(true);
  }
  if (mapsScriptPromise) return mapsScriptPromise;
  mapsScriptPromise = new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`;
    script.async = true;
    script.onload = () => resolve(Boolean(window.google?.maps?.places));
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return mapsScriptPromise;
}

export default function AddressAutocomplete({
  id,
  value,
  onChange,
  required,
  placeholder,
}: AddressAutocompleteProps) {
  const [mapsReady, setMapsReady] = useState(false);
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<GoogleMap | null>(null);
  const markerRef = useRef<GoogleMarker | null>(null);
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Config check first: no key means plain input, no script loaded.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/google-maps/config")
      .then((r) => r.json())
      .then(async (cfg: { configured?: boolean; apiKey?: string }) => {
        if (cancelled || !cfg?.configured || !cfg.apiKey) return;
        const ok = await loadGoogleMaps(cfg.apiKey);
        if (!cancelled && ok) setMapsReady(true);
      })
      .catch(() => {
        // Config unreachable — stay a plain input.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Attach the Places Autocomplete widget once the API is ready.
  useEffect(() => {
    if (
      !mapsReady ||
      !inputRef.current ||
      !window.google ||
      autocompleteRef.current
    ) {
      return;
    }
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["place_id", "formatted_address", "geometry"],
    });
    ac.setBounds(
      new window.google.maps.LatLngBounds(
        ARIZONA_BOUNDS_SW,
        ARIZONA_BOUNDS_NE
      )
    );
    ac.addListener("place_changed", () => {
      const p = ac.getPlace();
      const loc = p.geometry?.location;
      if (!p.place_id || !loc || !p.formatted_address) return;
      const picked: PickedPlace = {
        placeId: p.place_id,
        lat: loc.lat(),
        lng: loc.lng(),
      };
      setPlace(picked);
      onChangeRef.current(p.formatted_address, picked);
    });
    autocompleteRef.current = ac;
  }, [mapsReady]);

  // Small map with a pin, only after a place is picked.
  useEffect(() => {
    if (!place || !mapsReady || !mapRef.current || !window.google) return;
    const center = { lat: place.lat, lng: place.lng };
    if (!mapObjRef.current) {
      mapObjRef.current = new window.google.maps.Map(mapRef.current, {
        center,
        zoom: 15,
        disableDefaultUI: true,
        gestureHandling: "cooperative",
      });
      markerRef.current = new window.google.maps.Marker({
        position: center,
        map: mapObjRef.current,
      });
    } else {
      mapObjRef.current.setCenter(center);
      markerRef.current?.setPosition(center);
    }
  }, [place, mapsReady]);

  function handleTyping(v: string) {
    // Typing after a pick clears the picked place — the server then
    // re-checks the typed text on submit.
    if (place) setPlace(null);
    onChange(v);
  }

  return (
    <div>
      <input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => handleTyping(e.target.value)}
        required={required}
        placeholder={placeholder}
        autoComplete="off"
      />
      {place && (
        <div
          ref={mapRef}
          aria-label="Map of the selected address"
          style={{
            height: 180,
            borderRadius: 12,
            marginTop: 8,
            border: "1px solid var(--border, #ddd)",
          }}
        />
      )}
      {mapsReady && !place && value.trim().length > 0 && (
        <p className="small muted" style={{ marginTop: 4 }}>
          Pick your address from the Google suggestions — that confirms
          it&apos;s a real address.
        </p>
      )}
    </div>
  );
}
