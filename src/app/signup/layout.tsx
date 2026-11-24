import type { Metadata } from "next";

// Signup is a client component, so its metadata lives in this route layout.
export const metadata: Metadata = {
  title: "Join AZ House Bois — Homeowners & Bois",
  description:
    "Create your AZ House Bois account — homeowners book cleanings across Arizona, bois list themselves and keep 80% of every booking.",
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
