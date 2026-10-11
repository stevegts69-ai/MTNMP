import { logAudit } from "./audit";
import { supabase } from "./supabase";
import type { ToxicityAssessmentType, ToxicityEvent } from "../types";

interface CreateToxicityAssessmentParams {
  patientId: string;
  institutionId: string;
  assessedBy: string;
  assessmentType: ToxicityAssessmentType;
  cycleNumber: number | null;
  events: ToxicityEvent[];
  eventSummary?: string;
}

interface CreateToxicityAssessmentResult {
  assessmentId: string | null;
  alertId: string | null;
  error: string | null;
}

export async function createToxicityAssessmentWithAlerts({
  patientId,
  institutionId,
  assessedBy,
  assessmentType,
  cycleNumber,
  events,
  eventSummary,
}: CreateToxicityAssessmentParams): Promise<CreateToxicityAssessmentResult> {
  try {
    const { data: assessment, error: assessmentError } = await supabase
      .from("toxicity_assessments")
      .insert({
        patient_id: patientId,
        institution_id: institutionId,
        assessment_type: assessmentType,
        cycle_number: cycleNumber,
        ctcae_version: "5.0",
        events,
        assessed_by: assessedBy,
      })
      .select("id")
      .single();

    if (assessmentError) {
      return { assessmentId: null, alertId: null, error: assessmentError.message };
    }

    await logAudit({
      userId: assessedBy,
      institutionId,
      action: "create",
      tableName: "toxicity_assessments",
      recordId: assessment.id,
    });

    const severeEvents = events.filter((event) => event.grade >= 3);
    if (severeEvents.length === 0) {
      return { assessmentId: assessment.id, alertId: null, error: null };
    }

    const summary =
      eventSummary ??
      severeEvents
        .map((event) => `${event.category}: ${event.term} (Grade ${event.grade})`)
        .join("; ");
    const { data: alert, error: alertError } = await supabase
      .from("toxicity_alerts")
      .insert({
        patient_id: patientId,
        institution_id: institutionId,
        assessment_id: assessment.id,
        event_summary: summary,
      })
      .select("id")
      .single();

    if (alertError) {
      return {
        assessmentId: assessment.id,
        alertId: null,
        error: `Assessment saved, but the toxicity alert could not be created: ${alertError.message}`,
      };
    }

    await logAudit({
      userId: assessedBy,
      institutionId,
      action: "create",
      tableName: "toxicity_alerts",
      recordId: alert.id,
    });

    return { assessmentId: assessment.id, alertId: alert.id, error: null };
  } catch (error) {
    return {
      assessmentId: null,
      alertId: null,
      error: error instanceof Error ? error.message : "Unable to save toxicity assessment.",
    };
  }
}