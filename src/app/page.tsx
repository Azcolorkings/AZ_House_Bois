import Image from "next/image";
import Link from "next/link";
import LookPicker from "@/components/LookPicker";
import SubscribeButton from "@/components/SubscribeButton";

const AREAS = [
  "Phoenix", "Scottsdale", "Paradise Valley", "Tempe", "Mesa", "Chandler",
  "Gilbert", "Glendale", "Peoria", "Surprise", "Goodyear", "Queen Creek",
  "Tucson", "Oro Valley", "Flagstaff", "Sedona", "Prescott", "Lake Havasu", "Yuma",
];

const FAQS = [
  {
    q: "Is the cleaning actually good, or is it just a gimmick?",
    a: "It's a real regular clean first. Kitchens, bathrooms, floors, dusting — done properly every visit. The look is the bonus, not a substitute for the work.",
  },
  {
    q: "What exactly happens during a visit?",
    a: "Your boi arrives in the look you chose, cleans your home on the agreed checklist, and keeps it friendly and professional. You can be home and enjoy the view, chat, or relax — it's your house. It's a cleaning service, not an escort service, and boundaries are clear on both sides.",
  },
  {
    q: "How does membership work?",
    a: "It's two-sided: homeowners pay $20/month to see and book from the roster, and bois pay $20/month to list themselves. Subscribe below — cancel anytime from your dashboard.",
  },
  {
    q: "Do you really cover all of Arizona?",
    a: "That's the goal and the service area — Phoenix metro, Tucson, and cities across the state. Availability in smaller cities depends on bois listed there, which is why joining early helps us recruit for your area.",
  },
  {
    q: "Can I get the same boi every time?",
    a: "Yes — that's the point of regular cleaning. Most homeowners pick a favorite and lock in a weekly or bi-weekly schedule with him.",
  },
  {
    q: "I'm interested in working as a Boi. What do I need?",
    a: "Be 18+, reliable, comfortable in the playful uniforms, and actually good at cleaning (or willing to learn the checklist). Create a boi account, subscribe for $20/month, and publish your listing.",
  },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container">
          <p className="pill" style={{ background: "rgba(255,255,255,0.12)", color: "#fff6e9", border: "none" }}>
            Cleaning • Arizona
          </p>
          <h1 style={{ marginTop: 16 }}>
            Spotless house.
            <br />
            Serious <em>eye candy.</em>
          </h1>
          <p className="lede" style={{ marginTop: 16 }}>
            AZ House Bois is regular house cleaning with a twist you actually
            look forward to. A handsome boi in a skimpy, playful uniform comes
            to clean your home — thorough, professional, and very easy on the
            eyes. You enjoy the view. He handles the mess.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
            <Link href="/signup?role=client" className="btn btn-brand">
              I&apos;m a homeowner — browse bois
            </Link>
            <Link href="/signup?role=boi" className="btn btn-gold">
              I&apos;m a boi — get listed →
            </Link>
          </div>
          <p style={{ marginTop: 24 }} className="small">
            🏠 Weekly • Bi-weekly • Monthly &nbsp;·&nbsp; 🔒 Private &amp;
            discreet &nbsp;·&nbsp; 📍 Phoenix to Tucson &amp; beyond
          </p>
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        KITCHENS ✦ BATHROOMS ✦ FLOORS ✦ DUSTING ✦ LAUNDRY FOLD ✦ POOLSIDE TIDY ✦
        SCOTTSDALE ✦ PHOENIX ✦ TUCSON ✦ MESA ✦ TEMPE ✦&nbsp;
        KITCHENS ✦ BATHROOMS ✦ FLOORS ✦ DUSTING ✦ LAUNDRY FOLD ✦ POOLSIDE TIDY ✦
        SCOTTSDALE ✦ PHOENIX ✦ TUCSON ✦ MESA ✦ TEMPE ✦
      </div>

      <section className="section" id="concept">
        <div className="container grid-2" style={{ alignItems: "center" }}>
          <div>
            <h2>The concept</h2>
            <p style={{ fontSize: "1.15rem" }}>
              Not your average cleaning service. Anyone can hire a cleaner. AZ
              House Bois is for men who want the job done right — and want to
              enjoy who&apos;s doing it. Pick your boi, pick the look, set your
              regular schedule.
            </p>
            <p className="muted">
              Built for gay homeowners who want a clean house and a good time
              having it cleaned. Looks are playful — cleaning is serious.
              Boundaries are always respected, on both sides.
            </p>
          </div>
          <Image
            src="/images/hero-home.webp"
            alt="Luxurious, spotlessly clean Arizona desert home interior with views of cacti and mountains"
            width={1080}
            height={720}
            style={{ width: "100%", height: "auto", borderRadius: 20 }}
          />
        </div>
      </section>

      <section className="section" id="looks" style={{ background: "var(--surface2)" }}>
        <div className="container">
          <h2>Choose your look</h2>
          <p className="muted" style={{ maxWidth: 640 }}>
            Tap a vibe — this is what you can request when you book. Every look
            is skimpy and fun, never sloppy.
          </p>
          <div style={{ marginTop: 24 }}>
            <LookPicker />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2>Why guys book again &amp; again</h2>
          <div className="grid-3" style={{ marginTop: 24 }}>
            <div className="card">
              <h3>1. The clean is real.</h3>
              <p className="muted">Kitchens degreased, bathrooms scrubbed, floors done right — not a gimmick clean.</p>
            </div>
            <div className="card">
              <h3>2. It&apos;s your private show.</h3>
              <p className="muted">You&apos;re home, you relax, you enjoy the view while your place gets reset.</p>
            </div>
            <div className="card">
              <h3>3. It&apos;s regular.</h3>
              <p className="muted">Same boi, same day, no chasing a new cleaner every time.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="clean" style={{ background: "var(--surface2)" }}>
        <div className="container grid-2">
          <div>
            <h2>Regular house cleaning</h2>
            <p className="muted">Every visit includes a full regular clean — the stuff that makes a house feel brand new again.</p>
            <h3 style={{ marginTop: 24 }}>🍳 Kitchen</h3>
            <ul className="checklist">
              <li>Counters &amp; backsplash wiped &amp; shined</li>
              <li>Sink, faucet &amp; stovetop cleaned</li>
              <li>Outside of appliances polished</li>
              <li>Trash out, floors swept &amp; mopped</li>
            </ul>
            <h3 style={{ marginTop: 24 }}>🛁 Bathrooms</h3>
            <ul className="checklist">
              <li>Toilet, shower &amp; tub scrubbed</li>
              <li>Mirrors &amp; glass streak-free</li>
              <li>Sinks, counters &amp; fixtures shined</li>
              <li>Floors mopped, trash emptied</li>
            </ul>
            <h3 style={{ marginTop: 24 }}>🛋️ Living &amp; Bedrooms</h3>
            <ul className="checklist">
              <li>Dusting — shelves, fans, surfaces</li>
              <li>Beds made, linens changed if left out</li>
              <li>Floors vacuumed &amp; mopped</li>
              <li>Tidy, reset &amp; fluffed pillows</li>
            </ul>
          </div>
          <div>
            <Image
              src="/images/kitchen.webp"
              alt="Pristine modern Arizona kitchen with gleaming marble counters"
              width={1080}
              height={720}
              style={{ width: "100%", height: "auto", borderRadius: 20 }}
            />
            <div className="card" style={{ marginTop: 20 }}>
              <h3>Good for</h3>
              <p className="muted">
                Busy professionals, bachelors, couples, vacation homes, and
                hosts who want the place perfect before guests arrive. One-time
                regular cleans and recurring schedules — weekly, bi-weekly, or
                monthly.
              </p>
              <p>
                <strong>You provide:</strong> access + any special products you love.
                <br />
                <strong>Your boi brings:</strong> the energy, the look, and a proper clean.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="membership">
        <div className="container">
          <h2>Membership marketplace</h2>
          <p className="muted" style={{ maxWidth: 640 }}>
            Two sides. One roster. Homeowners subscribe to browse the bois.
            Bois subscribe to list themselves and get booked. That keeps it
            private, serious, and worth everyone&apos;s time.
          </p>
          <div className="grid-2" style={{ marginTop: 24 }}>
            <div className="card">
              <p className="pill">🏠 For homeowners</p>
              <h3 style={{ marginTop: 12 }}>Browse the bois</h3>
              <p className="muted">
                Your monthly membership unlocks the full list. See every
                available boi — photos, vibe &amp; looks offered. Filter by
                city, availability &amp; recurring schedule. Pick your favorite
                and book regular cleans directly. Private browsing — only
                members see the roster.
              </p>
              <p style={{ fontSize: "1.6rem", fontWeight: 900 }}>
                $20<span className="muted" style={{ fontSize: "1rem" }}>/month</span>
              </p>
              <SubscribeButton role="client" label="Subscribe as a homeowner" />
            </div>
            <div className="card">
              <p className="pill">🔥 For bois</p>
              <h3 style={{ marginTop: 12 }}>List yourself. Get booked.</h3>
              <p className="muted">
                Your monthly listing puts you in front of paying homeowners all
                over Arizona. Create your profile — photos, city, looks &amp;
                availability. Set the areas you&apos;ll travel to and your
                schedule. Get regular, recurring clients — not one-off gigs.
              </p>
              <p style={{ fontSize: "1.6rem", fontWeight: 900 }}>
                $20<span className="muted" style={{ fontSize: "1rem" }}>/month</span>
              </p>
              <SubscribeButton role="boi" label="Subscribe as a boi" className="btn btn-teal" />
            </div>
          </div>
          <p className="muted small" style={{ marginTop: 16 }}>
            Cancel anytime from your dashboard. Cleaning fees go through AZ
            House Bois — you never pay a cleaner on the side. The membership
            covers the roster and the listing only.
          </p>
        </div>
      </section>

      <section className="section section-dark" id="areas">
        <div className="container">
          <h2>All over Arizona</h2>
          <p className="muted" style={{ maxWidth: 640 }}>
            From big luxury homes in Paradise Valley to condos in Tucson — if
            you&apos;re in Arizona, we want a boi near you on the roster.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 24 }}>
            {AREAS.map((city) => (
              <span key={city} className="pill" style={{ background: "rgba(255,255,255,0.1)", color: "#fff6e9", border: "none" }}>
                {city}
              </span>
            ))}
            <span className="pill" style={{ background: "rgba(255,255,255,0.1)", color: "#fff6e9", border: "none" }}>
              + Everywhere in between
            </span>
          </div>
          <p style={{ marginTop: 20 }}>
            Don&apos;t see your city? Join anyway — demand in your city is how
            we recruit the next bois there.
          </p>
          <Image
            src="/images/pool.webp"
            alt="Upscale Arizona home with sparkling pool at sunset"
            width={1080}
            height={720}
            style={{ width: "100%", height: "auto", borderRadius: 20, marginTop: 20 }}
          />
        </div>
      </section>

      <section className="section" id="faq">
        <div className="container" style={{ maxWidth: 780 }}>
          <h2>FAQ</h2>
          <div style={{ marginTop: 24 }}>
            {FAQS.map((item) => (
              <details key={item.q} className="card" style={{ marginBottom: 12 }}>
                <summary style={{ fontWeight: 800, cursor: "pointer" }}>{item.q}</summary>
                <p className="muted" style={{ marginTop: 10 }}>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
