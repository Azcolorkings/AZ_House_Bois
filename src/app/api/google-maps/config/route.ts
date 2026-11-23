import { NextResponse } from "next/server";
import { googleMapsBrowserKey } from "@/lib/google-maps";

/**
 * Public Google Maps config for the booking address autocomplete.
 * Returns the public (NEXT_PUBLIC_) browser key and whether Maps is
 * usable — the server key is NEVER exposed here. The booking form
 * renders a plain text input when configured is false.
 */
export async function GET() {
  const apiKey = googleMapsBrowserKey();
  return NextResponse.json({
    configured: Boolean(apiKey),
    apiKey,
  });
}
