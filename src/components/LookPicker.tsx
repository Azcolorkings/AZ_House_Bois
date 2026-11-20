"use client";

import { useState } from "react";

const LOOKS: Record<string, { emoji: string; name: string; blurb: string; detail: string }> = {
  classic: {
    emoji: "🔥",
    name: "Classic Boi",
    blurb: "Tank, short shorts & apron. The signature AZ House Bois look.",
    detail: "Classic Boi — tank + short shorts + apron",
  },
  desert: {
    emoji: "🌵",
    name: "Desert Heat",
    blurb: "Shirtless with apron & shorts. Arizona summer, turned up.",
    detail: "Desert Heat — shirtless with apron & shorts",
  },
  poolside: {
    emoji: "🏖️",
    name: "Poolside",
    blurb: "Swim shorts & open shirt. Perfect for pool houses & patios.",
    detail: "Poolside — swim shorts & open shirt",
  },
  sporty: {
    emoji: "💪",
    name: "Sporty",
    blurb: "Gym shorts & cropped tank. Athletic, energetic, gets it done.",
    detail: "Sporty — gym shorts & cropped tank",
  },
};

export default function LookPicker() {
  const [selected, setSelected] = useState("classic");
  return (
    <div>
      <div className="grid-2">
        {Object.entries(LOOKS).map(([key, look]) => (
          <button
            key={key}
            type="button"
            className="card"
            style={{
              textAlign: "left",
              cursor: "pointer",
              borderColor: selected === key ? "var(--brand2)" : "var(--line)",
              boxShadow: selected === key ? "0 0 0 2px var(--brand2)" : "none",
            }}
            aria-pressed={selected === key}
            onClick={() => setSelected(key)}
          >
            <div style={{ fontSize: "2rem" }}>{look.emoji}</div>
            <h3 style={{ margin: "8px 0 4px" }}>{look.name}</h3>
            <p className="muted" style={{ margin: 0 }}>{look.blurb}</p>
          </button>
        ))}
      </div>
      <p style={{ marginTop: 16 }}>
        <strong>Selected: {LOOKS[selected].detail}</strong>
      </p>
      <p className="muted small">
        Professional rule that never changes: it&apos;s a cleaning service.
        Flirty look, friendly vibe — no funny business. Everyone&apos;s
        comfort and consent comes first.
      </p>
    </div>
  );
}
