import type { Metadata } from "next";
import { Anton, Manrope } from "next/font/google";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import "./globals.css";

const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const body = Manrope({ subsets: ["latin"], variable: "--font-body" });

const SITE_URL = "https://az-house-bois.vercel.app";
const SITE_DESCRIPTION =
  "Regular house cleaning all over Arizona. A handsome boi in a skimpy, playful uniform comes to clean your home — thorough, professional, and very easy on the eyes.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AZ House Bois — Arizona House Cleaning With Eye Candy",
    template: "%s | AZ House Bois",
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "AZ House Bois",
    title: "AZ House Bois — Arizona House Cleaning With Eye Candy",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/images/hero-home.webp",
        width: 1920,
        height: 1280,
        alt: "A house boi cleaning a bright, luxury Arizona living room",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "AZ House Bois — Arizona House Cleaning With Eye Candy",
    description: SITE_DESCRIPTION,
    images: ["/images/hero-home.webp"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "AZ House Bois",
  description:
    "House cleaning all over Arizona. A handsome, professional cleaner in a playful uniform comes to clean your home. Regular $180, deep $350, move-in/out $450.",
  url: SITE_URL,
  areaServed: [
    { "@type": "State", name: "Arizona" },
    { "@type": "City", name: "Phoenix" },
    { "@type": "City", name: "Mesa" },
    { "@type": "City", name: "Scottsdale" },
    { "@type": "City", name: "Tempe" },
  ],
  priceRange: "$180 - $450",
  sameAs: [
    "https://www.facebook.com/profile.php?id=61596831958881",
    "https://www.instagram.com/azhousebois/",
  ],
};

async function Header() {
  const session = await auth();
  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" style={{ textDecoration: "none", fontWeight: 900, fontSize: "1.25rem" }}>
          AZ HOUSE <span style={{ color: "var(--brand)" }}>BOIS</span>
        </Link>
        <nav>
          <Link href="/#clean">The Clean</Link>
          <Link href="/#looks">The Looks</Link>
          <Link href="/pricing">Membership</Link>
          <Link href="/#areas">Areas</Link>
          <Link href="/#faq">FAQ</Link>
          {session?.user ? (
            <>
              <Link href="/roster" className="keep">Roster</Link>
              <Link href="/dashboard" className="keep">Dashboard</Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button type="submit" className="btn btn-ghost" style={{ padding: "8px 16px" }}>
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="keep">Log in</Link>
              <Link href="/signup" className="btn btn-brand keep" style={{ padding: "10px 18px" }}>
                Join / Book →
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${display.variable} ${body.variable}`}>
        <Header />
        <main>{children}</main>
        <footer className="footer">
          <div className="container">
            <div>
              <strong>AZ HOUSE BOIS</strong>
              <p className="muted small" style={{ maxWidth: 420 }}>
                Regular house cleaning all over Arizona. Flirty look, friendly
                vibe — no funny business. It&apos;s a cleaning service, not an
                escort service, and boundaries are clear on both sides. 18+ only.
              </p>
            </div>
            <div className="small">
              <Link href="/pricing">Membership — $20/month</Link>
              <br />
              <Link href="/roster">Browse the roster</Link>
              <br />
              <Link href="/signup">Join as a homeowner or boi</Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
