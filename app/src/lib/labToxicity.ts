import type { LabReferenceRange, LabType, ToxicityEvent } from "../types";

const LAB_EVENT_DETAILS: Record<LabType, { category: string; term: string }> = {
  platelets: { category: "Hematologic", term: "Thrombocytopenia" },
  hemoglobin: { category: "Hematologic", term: "Anemia" },
  creatinine: { category: "Renal", term: "Creatinine increased" },
  egfr: { category: "Renal", term: "GFR decreased" },
  wbc: { category: "Hematologic", term: "Leukopenia" },
};

export interface LabToxicityEvent extends ToxicityEvent {
  labType: LabType;
  value: number;
  threshold: number;
  unit: string;
  abnormalDirection: LabReferenceRange["abnormal_direction"];
}

export function getGrade3LabEvents(
  values: Partial<Record<LabType, number | null>>,
  ranges: LabReferenceRange[]
): LabToxicityEvent[] {
  const rangeByType = new Map(ranges.map((range) => [range.lab_type, range]));
  const labTypes = Object.keys(LAB_EVENT_DETAILS) as LabType[];

  return labTypes.flatMap((labType) => {
    const value = values[labType];
    const range = rangeByType.get(labType);
    if (value === null || value === undefined || !range) return [];

    const crossesGrade3 =
      range.abnormal_direction === "low"
        ? value <= range.grade3_threshold
        : value >= range.grade3_threshold;
    if (!crossesGrade3) return [];

    const detail = LAB_EVENT_DETAILS[labType];
    return [{
      category: detail.category,
      term: `${detail.term} (lab-derived)`,
      grade: 3 as const,
      labType,
      value,
      threshold: range.grade3_threshold,
      unit: range.unit,
      abnormalDirection: range.abnormal_direction,
    }];
  });
}

export function summarizeGrade3LabEvents(events: LabToxicityEvent[]): string {
  return events
    .map((event) => {
      const comparator = event.abnormalDirection === "low" ? "≤" : "≥";
      return `${event.category}: ${event.term.replace(" (lab-derived)", "")} (Grade 3+, lab-derived; value ${event.value} ${event.unit}, threshold ${comparator} ${event.threshold} ${event.unit})`;
    })
    .join("; ");
}