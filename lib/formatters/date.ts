type DateValue = Date | string | number;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function toValidDate(value: DateValue): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Stable UTC date text for markup rendered by both the server and browser. */
export function formatUtcDate(value: DateValue): string {
  const date = toValidDate(value);
  if (!date) return "Unknown date";
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** Stable UTC time text for markup rendered by both the server and browser. */
export function formatUtcTime(value: DateValue): string {
  const date = toValidDate(value);
  if (!date) return "Unknown time";

  const hours = date.getUTCHours();
  const hour12 = hours % 12 || 12;
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  return `${hour12}:${minutes}:${seconds} ${period} UTC`;
}
