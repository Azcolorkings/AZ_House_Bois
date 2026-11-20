import type { Metadata } from "next";
import { Anton, Manrope } from "next/font/google";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import "./globals.css";

const display = Anton({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const body = Manrope({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "AZ House Bois — Arizona House Cleaning With Eye Candy",
  description:
    "Regular house cleaning all over Arizona. A handsome boi in a skimpy, playful uniform comes to clean your home — thorough, professional, and very easy on the eyes.",
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
