-- Add delivery-phase tracking to projects (post-bid-accept lifecycle)
-- and support for nested subtasks.

-- Project delivery phases (separate from status which tracks the bid lifecycle)
alter table public.projects
  add column phase text not null default 'oppstart' check (
    phase in (
      'oppstart',    -- Kick-off, planning
      'design',      -- Design, wireframes, approvals
      'utvikling',   -- Build, development
      'review',      -- QA, stakeholder review
      'levering',    -- Launch, handover
      'fullfort'     -- Done
    )
  );

-- Default phase for already-signed projects
update public.projects
  set phase = 'fullfort'
  where status = 'completed';
update public.projects
  set phase = 'oppstart'
  where status in ('in_progress', 'matched');

create index projects_phase_idx on public.projects(phase);

-- Subtasks: let any task have a parent
alter table public.project_tasks
  add column parent_id uuid references public.project_tasks(id) on delete cascade;

create index project_tasks_parent_idx
  on public.project_tasks(parent_id)
  where parent_id is not null;
