/** Shared display formatters (client + server safe). */

/** ₹ formatting in Indian units (L / Cr). */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—";
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(2).replace(/\.00$/, "")} Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1).replace(/\.0$/, "")} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatBudgetRange(
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  if (!min && !max) return "Budget not set";
  if (min && max) return `${formatINR(min)} – ${formatINR(max)}`;
  return formatINR(min ?? max);
}

/** WhatsApp deep link (user's own app — not a provider send). */
export function waLink(phone: string, text?: string): string {
  const digits = phone.replace(/[^0-9]/g, "");
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${query}`;
}
