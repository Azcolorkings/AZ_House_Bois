import type { Metadata } from "next";

// Login is a client component, so its metadata lives in this route layout.
export const metadata: Metadata = {
  title: "Log In | AZ House Bois",
  description:
    "Log in to your AZ House Bois account to manage bookings, your listing, or your membership.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
