import type { KetosisZone } from "../types";

/**
 * Computes a descriptive ketosis zone indicator from glucose and ketone readings.
 *
 * IMPORTANT: This is a simple, disclosed-threshold descriptive indicator for
 * tracking purposes only — NOT a clinical diagnostic or treatment recommendation.
 * Thresholds are based on commonly cited nutritional ketosis ranges, not
 * individualized clinical targets. Physicians should not treat this as
 * medical guidance; it exists to help visualize logged trends over time.
 *
 * green:  ketones >= 0.5 mmol/L AND glucose <= 5.5 mmol/L (commonly cited nutritional ketosis range)
 * red:    ketones < 0.3 mmol/L OR glucose > 7.8 mmol/L (clearly outside ketosis range)
 * yellow: everything in between
 */
export function computeKetosisZone(
  glucose: number | null | undefined,
  ketones: number | null | undefined
): KetosisZone | null {
  if (glucose == null || ketones == null) return null;

  if (ketones >= 0.5 && glucose <= 5.5) return "green";
  if (ketones < 0.3 || glucose > 7.8) return "red";
  return "yellow";
}

export const ZONE_COLORS: Record<KetosisZone, string> = {
  green: "#2E7D6B",
  yellow: "#C9A227",
  red: "#B3261E",
};

export const ZONE_LABELS: Record<KetosisZone, string> = {
  green: "In range",
  yellow: "Borderline",
  red: "Outside range",
};