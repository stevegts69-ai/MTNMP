import type { LesionMeasurement } from "../types";

export type RecistCategory = "CR" | "PR" | "SD" | "PD";

export interface RecistTimepointSummary {
  date: string;
  targetLesionSum: number;
  percentChangeFromBaseline: number | null;
  category: RecistCategory;
  hasNewLesion: boolean;
}

export function percentChangeFromFirst(values: number[]): number | null {
  if (values.length < 2 || values[0] === 0) return null;
  return ((values[values.length - 1] - values[0]) / values[0]) * 100;
}

export function summarizeRecist(
  records: LesionMeasurement[]
): RecistTimepointSummary[] {
  const recistRecords = records.filter((record) => record.method === "RECIST_1_1");
  const grouped = new Map<string, LesionMeasurement[]>();
  for (const record of recistRecords) {
    const existing = grouped.get(record.timepoint_date) ?? [];
    existing.push(record);
    grouped.set(record.timepoint_date, existing);
  }

  const dates = [...grouped.keys()].sort();
  const baselineDate = dates.find((date) =>
    (grouped.get(date) ?? []).some((record) => record.is_target_lesion)
  );
  const baselineSum = baselineDate
    ? (grouped.get(baselineDate) ?? [])
        .filter((record) => record.is_target_lesion)
        .reduce((sum, record) => sum + (record.measurement_mm ?? 0), 0)
    : 0;
  let nadir = Number.POSITIVE_INFINITY;
  let newLesionSeen = false;
  let lastTargetSum = baselineSum;

  return dates.filter((date) => date >= (baselineDate ?? "")).map((date) => {
    const timepoint = grouped.get(date) ?? [];
    const measuredTargets = timepoint.filter((record) => record.is_target_lesion);
    if (measuredTargets.length > 0) {
      lastTargetSum = measuredTargets.reduce(
      (sum, record) => sum + (record.measurement_mm ?? 0),
      0
      );
    }
    const targetLesionSum = lastTargetSum;
    const hasNewLesion = timepoint.some((record) => record.is_new_lesion);
    newLesionSeen ||= hasNewLesion;
    nadir = Math.min(nadir, targetLesionSum);

    const percentChangeFromBaseline =
      baselineSum === 0 ? null : ((targetLesionSum - baselineSum) / baselineSum) * 100;
    let category: RecistCategory = "SD";
    if (newLesionSeen) {
      category = "PD";
    } else if (targetLesionSum === 0) {
      category = "CR";
    } else if (percentChangeFromBaseline !== null && percentChangeFromBaseline <= -30) {
      category = "PR";
    } else if (
      Number.isFinite(nadir) &&
      targetLesionSum >= nadir * 1.2 &&
      targetLesionSum - nadir >= 5
    ) {
      category = "PD";
    }

    return {
      date,
      targetLesionSum,
      percentChangeFromBaseline,
      category,
      hasNewLesion,
    };
  });
}