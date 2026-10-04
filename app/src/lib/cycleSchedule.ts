export function calculateNextCycleDueDate(
  administeredDate: string | null | undefined,
  intervalDays: number | null | undefined
): string | null {
  if (!administeredDate || !intervalDays || intervalDays < 1) return null;

  const date = new Date(`${administeredDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;

  date.setUTCDate(date.getUTCDate() + intervalDays);
  return date.toISOString().slice(0, 10);
}