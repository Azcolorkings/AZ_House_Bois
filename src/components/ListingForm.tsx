"use client";

import { useState } from "react";
import type { ListingRow } from "@/lib/db";

const LOOKS = ["Classic Boi", "Desert Heat", "Poolside", "Sporty"];
const CITIES = [
  "Phoenix", "Scottsdale", "Paradise Valley", "Tempe", "Mesa", "Chandler",
  "Gilbert", "Glendale", "Peoria", "Surprise", "Goodyear", "Queen Creek",
  "Tucson", "Oro Valley", "Flagstaff", "Sedona", "Prescott", "Lake Havasu", "Yuma",
];

export default function ListingForm({ existing }: { existing: ListingRow | null }) {
  const [displayName, setDisplayName] = useState(existing?.display_name ?? "");
  const [city, setCity] = useState(existing?.city ?? "Phoenix");
  const [looks, setLooks] = useState<string[]>(existing?.looks ?? ["Classic Boi"]);
  const [availability, setAvailability] = useState(existing?.availability ?? "Weekly");
  const [bio, setBio] = useState(existing?.bio ?? "");
  const [experience, setExperience] = useState(existing?.experience ?? "");
  const [serviceAreas, setServiceAreas] = useState(existing?.service_areas ?? "");
  const [photoUrl, setPhotoUrl] = useState(existing?.photo_url ?? "");
  const [published, setPublished] = useState(existing?.published ?? false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function toggleLook(look: string) {
    setLooks((prev) =>
      prev.includes(look) ? prev.filter((l) => l !== look) : [...prev, look]
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const res = await fetch("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName,
        city,
        looks,
        availability,
        bio,
        experience,
        service_areas: serviceAreas,
        photo_url: photoUrl || null,
        published,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Could not save the listing.");
      setBusy(false);
      return;
    }
    setMessage(
      published
        ? "Your listing is live on the roster."
        : "Listing saved as a draft — turn on publish to go live."
    );
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="display_name">Display name</label>
      <input
        id="display_name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        required
        placeholder="The name homeowners will see"
      />
      <label htmlFor="city">City</label>
      <select id="city" value={city} onChange={(e) => setCity(e.target.value)}>
        {CITIES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <label>Looks you offer</label>
      <div>
        {LOOKS.map((look) => (
          <button
            key={look}
            type="button"
            className="look-chip"
            aria-pressed={looks.includes(look)}
            onClick={() => toggleLook(look)}
          >
            {look}
          </button>
        ))}
      </div>
      <label htmlFor="availability">Availability</label>
      <select id="availability" value={availability} onChange={(e) => setAvailability(e.target.value)}>
        <option>Weekly</option>
        <option>Every 2 weeks</option>
        <option>Monthly</option>
        <option>Weekends only</option>
        <option>Flexible — ask me</option>
      </select>
      <label htmlFor="bio">About you</label>
      <textarea
        id="bio"
        rows={4}
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="A couple of lines: your vibe, what you're great at cleaning, the areas you'll travel to."
      />
      <label htmlFor="experience">Cleaning experience</label>
      <textarea
        id="experience"
        rows={3}
        value={experience}
        onChange={(e) => setExperience(e.target.value)}
        placeholder="Filled in from your application — edit it anytime. e.g. 2 years cleaning houses and apartments."
      />
      <label htmlFor="service_areas">Service areas</label>
      <input
        id="service_areas"
        value={serviceAreas}
        onChange={(e) => setServiceAreas(e.target.value)}
        placeholder="Filled in from your application — e.g. Mesa, Tempe, Phoenix"
      />
      {(() => {
        // The pasted URL wins; otherwise the photo from the application
        // is the roster photo.
        const previewSrc = photoUrl || existing?.photo_data || null;
        if (!previewSrc) return null;
        return (
          <div style={{ marginTop: 4 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt="Your roster photo"
              style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12 }}
            />
            <p className="small muted" style={{ margin: "6px 0 0" }}>
              {photoUrl
                ? "Showing your photo URL."
                : "Showing your application photo — paste a URL below to use a different photo instead."}
            </p>
          </div>
        );
      })()}
      <label htmlFor="photo_url">Photo URL (optional)</label>
      <input
        id="photo_url"
        type="url"
        value={photoUrl}
        onChange={(e) => setPhotoUrl(e.target.value)}
        placeholder="https://… link to a photo of you — overrides your application photo"
      />
      <p className="small muted" style={{ margin: "4px 0 0" }}>
        Leave this empty to keep your application photo. Clear it to go back
        to your application photo.
      </p>
      <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}>
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          style={{ width: "auto" }}
        />
        Published — show me on the roster
      </label>
      {error && <div className="error" role="alert">{error}</div>}
      {message && <div className="success" role="status">{message}</div>}
      <button type="submit" className="btn btn-teal" disabled={busy} style={{ marginTop: 20 }}>
        {busy ? "Saving…" : "Save my listing"}
      </button>
    </form>
  );
}
