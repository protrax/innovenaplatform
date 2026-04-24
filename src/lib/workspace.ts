import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Task, TaskMember } from "@/components/workspace/tasks-panel";
import type { Message, MessageActor } from "@/components/workspace/messages-panel";
import type { ProjectFile } from "@/components/workspace/files-panel";

// Fetch everything needed for the shared project workspace panels in one go.
// Uses admin client for profile lookups so we can show names across tenant boundaries.
export async function fetchWorkspaceData(params: {
  projectId: string;
  tenantId: string | null;
  customerId: string;
  includeInternal: boolean;
}) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const [tasksRes, filesRes, messagesRes] = await Promise.all([
    (() => {
      const q = supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", params.projectId)
        .order("sort_order", { ascending: true });
      return params.tenantId ? q.eq("tenant_id", params.tenantId) : q;
    })(),
    (() => {
      const q = supabase
        .from("project_files")
        .select("*")
        .eq("project_id", params.projectId)
        .order("created_at", { ascending: false });
      return params.tenantId
        ? q.or(`tenant_id.eq.${params.tenantId},tenant_id.is.null`)
        : q;
    })(),
    supabase
      .from("messages")
      .select("*")
      .eq("project_id", params.projectId)
      .eq("channel", "project")
      .order("created_at", { ascending: true })
      .limit(200),
  ]);

  const tasks = (tasksRes.data ?? []).filter(
    (t) => params.includeInternal || t.visibility !== "internal",
  ) as Task[];
  const files = (filesRes.data ?? []).filter(
    (f) => params.includeInternal || f.visibility !== "internal",
  );
  const messages = (messagesRes.data ?? []) as Message[];

  // Collect all user IDs we need names for
  const userIds = new Set<string>();
  for (const t of tasks) if (t.assigned_to) userIds.add(t.assigned_to);
  for (const f of files) userIds.add(f.uploaded_by);
  for (const m of messages) userIds.add(m.sender_id);
  userIds.add(params.customerId);

  const profilesById = new Map<
    string,
    { full_name: string | null; email: string }
  >();
  if (userIds.size > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", Array.from(userIds));
    for (const p of profiles ?? []) {
      profilesById.set(p.id, { full_name: p.full_name, email: p.email });
    }
  }

  function nameFor(userId: string): string {
    const p = profilesById.get(userId);
    if (!p) return "Ukjent";
    return p.full_name ?? p.email.split("@")[0];
  }

  // Tenant members for task assignee dropdown
  let members: TaskMember[] = [];
  if (params.tenantId) {
    const { data: memberRows } = await supabase
      .from("tenant_members")
      .select("user_id")
      .eq("tenant_id", params.tenantId);
    members = (memberRows ?? []).map((m) => ({
      user_id: m.user_id,
      name: nameFor(m.user_id),
    }));
  }

  // Build actors list for messages
  const actorMap = new Map<string, MessageActor>();
  actorMap.set(params.customerId, {
    user_id: params.customerId,
    name: nameFor(params.customerId),
    role: "customer",
  });
  for (const m of members) {
    actorMap.set(m.user_id, { user_id: m.user_id, name: m.name, role: "agency" });
  }
  const actors: MessageActor[] = Array.from(actorMap.values());

  const filesWithNames: ProjectFile[] = files.map((f) => ({
    ...f,
    uploader_name: nameFor(f.uploaded_by),
  }));

  return { tasks, files: filesWithNames, messages, members, actors };
}
