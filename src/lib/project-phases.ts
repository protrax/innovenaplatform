// Delivery phases for a signed project. Ordered from start to done.
// Keep in sync with the `phase` check constraint in migration 14.

export type ProjectPhase =
  | "oppstart"
  | "design"
  | "utvikling"
  | "review"
  | "levering"
  | "fullfort";

export interface PhaseDef {
  id: ProjectPhase;
  label: string;
  description: string;
  color: string; // tailwind-compatible hex
  done?: boolean;
}

export const PHASES: PhaseDef[] = [
  {
    id: "oppstart",
    label: "Oppstart",
    description: "Kick-off, brief, tilganger",
    color: "#94a3b8",
  },
  {
    id: "design",
    label: "Design",
    description: "Wireframes, visuelt design, godkjenning",
    color: "#f59e0b",
  },
  {
    id: "utvikling",
    label: "Utvikling",
    description: "Bygging, implementasjon",
    color: "#3b82f6",
  },
  {
    id: "review",
    label: "Review",
    description: "QA, interne runder, kundegjennomgang",
    color: "#a855f7",
  },
  {
    id: "levering",
    label: "Levering",
    description: "Launch, handover, opplæring",
    color: "#ff7849",
  },
  {
    id: "fullfort",
    label: "Fullført",
    description: "Ferdig levert",
    color: "#10b981",
    done: true,
  },
];

export function phaseDef(id: string): PhaseDef {
  return PHASES.find((p) => p.id === id) ?? PHASES[0];
}
