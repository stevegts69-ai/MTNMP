import { supabase } from "./supabase";

export type AuditAction = "view" | "create" | "update" | "delete" | "export";

interface LogAuditParams {
  userId: string;
  institutionId: string;
  action: AuditAction;
  tableName: string;
  recordId?: string | null;
}

/**
 * Logs an action to the append-only audit_logs table.
 * Failures here are swallowed deliberately — audit logging should never
 * block or fail the user's actual action (e.g. saving a patient record).
 */
export async function logAudit({
  userId,
  institutionId,
  action,
  tableName,
  recordId,
}: LogAuditParams): Promise<void> {
  try {
    await supabase.from("audit_logs").insert({
      user_id: userId,
      institution_id: institutionId,
      action,
      table_name: tableName,
      record_id: recordId ?? null,
    });
  } catch {
    // Intentionally silent — see comment above.
  }
}