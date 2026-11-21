/**
 * Age checks for the 18+ rule (both sides of the site: homeowners and
 * cleaners). Pure functions — safe to import from server routes and from
 * client components alike.
 */

/** Parse a YYYY-MM-DD date string. Returns null when it is not a real date. */
export function parseDob(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * True when a person born on `dob` (YYYY-MM-DD) is 18 or older today.
 * Compares month and day, not just the year — someone born Dec 31, 2008
 * is still 17 on Nov 21, 2026.
 */
export function isAtLeast18(dob: string): boolean {
  const birth = parseDob(dob);
  if (!birth) return false;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age >= 18;
}
