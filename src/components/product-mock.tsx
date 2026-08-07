// Abstract, code-drawn product mocks. Replaces the broken AI-generated
// product-shot PNGs (they contained rendered download-page garbage).
// Pure skeleton shapes — no text — so they read as "UI" at any size.

type Variant = "kanban" | "editor" | "tasks" | "timer";

function Bar({ w, tone }: { w: string; tone: string }) {
  return <div className={`h-2 rounded-full ${w} ${tone}`} />;
}

function KanbanCard({ accent }: { accent?: boolean }) {
  return (
    <div className="space-y-2 rounded-md bg-white/[0.07] p-3 ring-1 ring-white/10">
      <Bar w="w-3/4" tone="bg-white/30" />
      <Bar w="w-1/2" tone="bg-white/15" />
      <div className="flex items-center justify-between pt-1">
        <span className={`h-2 w-8 rounded-full ${accent ? "bg-[#dfff00]/80" : "bg-white/15"}`} />
        <span className="h-4 w-4 rounded-full bg-white/15" />
      </div>
    </div>
  );
}

export function ProductMock({ variant = "kanban" }: { variant?: Variant }) {
  return (
    <div className="aspect-[3/2] w-full bg-[#161815] p-5 md:p-7" aria-hidden>
      {/* top chrome */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-[#dfff00]" />
          <Bar w="w-20" tone="bg-white/25" />
        </div>
        <div className="flex items-center gap-2">
          <Bar w="w-10" tone="bg-white/10" />
          <span className="h-5 w-14 rounded bg-[#dfff00]/90" />
        </div>
      </div>

      {variant === "kanban" && (
        <div className="grid h-[80%] grid-cols-3 gap-4">
          {[0, 1, 2].map((col) => (
            <div key={col} className="space-y-3 rounded-lg bg-white/[0.04] p-3">
              <Bar w="w-1/2" tone="bg-white/20" />
              <KanbanCard accent={col === 0} />
              <KanbanCard />
              {col !== 2 ? <KanbanCard accent={col === 1} /> : null}
            </div>
          ))}
        </div>
      )}

      {variant === "editor" && (
        <div className="grid h-[80%] grid-cols-2 gap-4">
          <div className="space-y-3 rounded-lg bg-white/[0.04] p-4">
            {["w-full", "w-5/6", "w-full", "w-2/3", "w-3/4", "w-1/2"].map((w, i) => (
              <Bar key={i} w={w} tone="bg-white/15" />
            ))}
          </div>
          <div className="space-y-3 rounded-lg bg-white/[0.07] p-4 ring-1 ring-[#dfff00]/30">
            <Bar w="w-1/3" tone="bg-[#dfff00]/80" />
            {["w-full", "w-full", "w-4/5", "w-full", "w-2/3"].map((w, i) => (
              <Bar key={i} w={w} tone="bg-white/25" />
            ))}
          </div>
        </div>
      )}

      {variant === "tasks" && (
        <div className="h-[80%] space-y-3 rounded-lg bg-white/[0.04] p-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-md bg-white/[0.06] p-3">
              <span className={`h-4 w-4 rounded ${i < 2 ? "bg-[#dfff00]/80" : "bg-white/15"}`} />
              <Bar w={i % 2 ? "w-1/2" : "w-2/3"} tone="bg-white/25" />
              <span className="ml-auto h-2 w-10 rounded-full bg-white/15" />
            </div>
          ))}
        </div>
      )}

      {variant === "timer" && (
        <div className="grid h-[80%] grid-cols-[1fr_2fr] gap-4">
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg bg-white/[0.07] p-4 ring-1 ring-[#dfff00]/30">
            <span className="h-14 w-14 rounded-full border-4 border-[#dfff00]/80" />
            <Bar w="w-2/3" tone="bg-white/25" />
          </div>
          <div className="flex h-full items-end gap-2 rounded-lg bg-white/[0.04] p-4">
            {["h-1/3", "h-2/3", "h-1/2", "h-full", "h-2/5", "h-3/4", "h-1/2"].map((h, i) => (
              <div key={i} className={`w-full rounded-t ${h} ${i === 3 ? "bg-[#dfff00]/80" : "bg-white/15"}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
