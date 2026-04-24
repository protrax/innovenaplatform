import { createAdminClient } from "@/lib/supabase/admin";
import { generateProjectPlan, type ProjectPlanInput } from "@/lib/ai/operations";

// Generates an AI project plan and writes it to project_tasks. Idempotent
// within a project: wipes existing AI-generated tasks first, keeps manual ones
// untouched.
export async function generateAndSaveProjectPlan(args: {
  projectId: string;
  tenantId: string;
  customerId: string;
  createdById: string; // usually a tenant owner/admin
  input: ProjectPlanInput;
  startFrom?: Date;
}): Promise<{ tasksInserted: number }> {
  const admin = createAdminClient();

  // Generate plan
  const plan = await generateProjectPlan(args.input);

  // Remove prior AI-generated rows so a regeneration doesn't pile up
  await admin
    .from("project_tasks")
    .delete()
    .eq("project_id", args.projectId)
    .eq("source", "ai_plan");

  const start = args.startFrom ?? new Date();
  const rows = plan.tasks.map((t, i) => {
    const due = new Date(start);
    due.setDate(due.getDate() + Math.max(0, Math.round(t.days_after_start)));
    return {
      project_id: args.projectId,
      tenant_id: args.tenantId,
      created_by: args.createdById,
      assigned_to: t.owner === "customer" ? args.customerId : null,
      title: t.title,
      description: t.description,
      status: "todo" as const,
      visibility: t.visibility,
      due_date: due.toISOString().slice(0, 10),
      sort_order: i,
      source: "ai_plan",
    };
  });

  if (rows.length === 0) return { tasksInserted: 0 };

  const { error } = await admin.from("project_tasks").insert(rows);
  if (error) {
    console.error("[project-plan] insert failed:", error);
    throw new Error(error.message);
  }
  return { tasksInserted: rows.length };
}
