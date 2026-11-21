"use client";

import { useState } from "react";
import { AGREEMENT_TEXT } from "@/lib/agreement";
import { isAtLeast18 } from "@/lib/age";

const AVAILABILITY = [
  "Weekly",
  "Every 2 weeks",
  "Monthly",
  "Weekends only",
  "Flexible — ask me",
];

const MAX_FILE_BYTES = 3 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

export default function ApplicationForm() {
  const [legalName, setLegalName] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [ssn, setSsn] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [experience, setExperience] = useState("");
  const [availability, setAvailability] = useState("Weekly");
  const [serviceAreas, setServiceAreas] = useState("");
  const [photoData, setPhotoData] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [idData, setIdData] = useState("");
  const [idName, setIdName] = useState("");
  const [signature, setSignature] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function pickFile(
    file: File | undefined,
    setData: (v: string) => void,
    setName: (v: string) => void
  ) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That has to be an image file (photo).");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("That image is over 3 MB — pick a smaller one.");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setData(dataUrl);
      setName(file.name);
      setError("");
    } catch {
      setError("Could not read that image. Try another one.");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    if (!isAtLeast18(dob)) {
      setError("You have to be 18 or older to apply.");
      setBusy(false);
      return;
    }
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        legal_name: legalName,
        dob,
        address,
        phone,
        ssn,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
        experience,
        availability,
        service_areas: serviceAreas,
        photo_data: photoData,
        id_upload_data: idData,
        agreement_signature: signature,
        agreed,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error || "Could not save the application.");
      setBusy(false);
      return;
    }
    setDone(true);
    setBusy(false);
  }

  if (done) {
    return (
      <div className="success" role="status">
        <strong>Application sent.</strong> It&apos;s under review now. You
        don&apos;t pay anything yet — the $20/month listing fee only starts
        after you&apos;re approved. Check your dashboard for the decision.
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div
        className="card"
        style={{
          background: "var(--surface2)",
          border: "2px solid var(--gold)",
          marginBottom: 8,
        }}
      >
        <h3 style={{ marginBottom: 8 }}>Read this first — the fee</h3>
        <p style={{ margin: 0 }}>
          Listing your profile on AZ House Bois costs{" "}
          <strong>$20 a month</strong>. You pay <strong>nothing</strong> to
          apply, and you pay <strong>nothing</strong> unless your application
          is approved. If you&apos;re denied, you owe nothing. After approval,
          the $20/month starts and you can cancel anytime.
        </p>
      </div>

      <h3 style={{ marginTop: 28 }}>About you</h3>
      <label htmlFor="legal_name">Full legal name</label>
      <input
        id="legal_name"
        value={legalName}
        onChange={(e) => setLegalName(e.target.value)}
        required
        autoComplete="name"
        placeholder="Your full legal name, as on your ID"
      />
      <label htmlFor="dob">Date of birth</label>
      <input
        id="dob"
        type="date"
        value={dob}
        onChange={(e) => setDob(e.target.value)}
        required
      />
      <p className="small muted">You must be 18 or older.</p>
      <label htmlFor="address">Address</label>
      <input
        id="address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        required
        autoComplete="street-address"
        placeholder="Street, city, state, ZIP"
      />
      <label htmlFor="phone">Phone</label>
      <input
        id="phone"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
        autoComplete="tel"
      />

      <h3 style={{ marginTop: 28 }}>For your 1099</h3>
      <p className="small muted">
        Cleaners are 1099 independent contractors, not employees. We need
        your Social Security number so we can file your 1099. It&apos;s
        encrypted and stored securely — it&apos;s never shown in plain text on
        the site.
      </p>
      <label htmlFor="ssn">Social Security number (SSN)</label>
      <input
        id="ssn"
        inputMode="numeric"
        value={ssn}
        onChange={(e) => setSsn(e.target.value)}
        required
        autoComplete="off"
        placeholder="123-45-6789"
      />

      <label htmlFor="emergency_name">Emergency contact — name</label>
      <input
        id="emergency_name"
        value={emergencyName}
        onChange={(e) => setEmergencyName(e.target.value)}
        required
        placeholder="Someone we can call if something happens on a job"
      />
      <label htmlFor="emergency_phone">Emergency contact — phone</label>
      <input
        id="emergency_phone"
        type="tel"
        value={emergencyPhone}
        onChange={(e) => setEmergencyPhone(e.target.value)}
        required
      />

      <h3 style={{ marginTop: 28 }}>Cleaning work</h3>
      <label htmlFor="experience">Cleaning experience</label>
      <textarea
        id="experience"
        rows={4}
        value={experience}
        onChange={(e) => setExperience(e.target.value)}
        required
        placeholder="What cleaning have you done before? Homes, offices, rentals — a few lines is fine."
      />
      <label htmlFor="availability">Availability</label>
      <select
        id="availability"
        value={availability}
        onChange={(e) => setAvailability(e.target.value)}
      >
        {AVAILABILITY.map((a) => (
          <option key={a}>{a}</option>
        ))}
      </select>
      <label htmlFor="service_areas">Service areas</label>
      <input
        id="service_areas"
        value={serviceAreas}
        onChange={(e) => setServiceAreas(e.target.value)}
        required
        placeholder="Cities or areas you'll travel to, e.g. Mesa, Tempe, Phoenix"
      />

      <h3 style={{ marginTop: 28 }}>Photos</h3>
      <label htmlFor="photo">Profile photo</label>
      <input
        id="photo"
        type="file"
        accept="image/*"
        onChange={(e) =>
          pickFile(e.target.files?.[0], setPhotoData, setPhotoName)
        }
        required={!photoData}
      />
      {photoData && (
        <p className="small" style={{ marginTop: 8 }}>
          ✓ {photoName || "Photo attached"}
          <br />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoData}
            alt="Profile photo preview"
            style={{ maxWidth: 160, borderRadius: 12, marginTop: 8 }}
          />
        </p>
      )}
      <label htmlFor="id_upload">Upload your ID</label>
      <input
        id="id_upload"
        type="file"
        accept="image/*"
        onChange={(e) => pickFile(e.target.files?.[0], setIdData, setIdName)}
        required={!idData}
      />
      <p className="small muted">
        A photo of your government photo ID (driver&apos;s license or state
        ID). Used to verify who you are for the 1099 file — it&apos;s only
        seen by the site admin.
      </p>
      {idData && (
        <p className="small" style={{ marginTop: 8 }}>
          ✓ {idName || "ID attached"}
          <br />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={idData}
            alt="ID preview"
            style={{ maxWidth: 220, borderRadius: 12, marginTop: 8 }}
          />
        </p>
      )}

      <h3 style={{ marginTop: 28 }}>Contractor agreement</h3>
      <div
        className="card"
        style={{
          background: "var(--surface2)",
          maxHeight: 320,
          overflowY: "auto",
          whiteSpace: "pre-wrap",
          fontSize: "0.95rem",
        }}
      >
        {AGREEMENT_TEXT}
      </div>
      <label
        style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 16 }}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={{ width: "auto", marginTop: 4 }}
        />
        <span>
          I have read the contractor agreement above and I agree to all of it.
        </span>
      </label>
      <label htmlFor="signature">Type your full legal name to sign</label>
      <input
        id="signature"
        value={signature}
        onChange={(e) => setSignature(e.target.value)}
        required
        autoComplete="off"
        placeholder="Must match your full legal name above"
      />
      <p className="small muted">
        Signed today,{" "}
        {new Date().toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
        .
      </p>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <button
        type="submit"
        className="btn btn-brand"
        disabled={busy}
        style={{ width: "100%", marginTop: 20 }}
      >
        {busy ? "Sending your application…" : "Submit my application"}
      </button>
      <p className="small muted" style={{ marginTop: 12 }}>
        No payment is due now. If you&apos;re approved, you&apos;ll pay the
        $20/month listing fee then — never before.
      </p>
    </form>
  );
}
