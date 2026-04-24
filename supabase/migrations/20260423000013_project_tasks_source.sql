-- Track where a task came from so we can regenerate AI-planned tasks without
-- wiping the agency's own manual additions.
alter table public.project_tasks
  add column source text not null default 'manual'
    check (source in ('manual', 'ai_plan'));

create index project_tasks_source_idx on public.project_tasks(project_id, source);
