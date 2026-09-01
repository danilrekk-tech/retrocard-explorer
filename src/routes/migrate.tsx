import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import {
  Label,
  Panel,
  RetroButton,
  SECTION_NOOP,
  SectionTitle,
  StatCard,
  Tag,
} from "@/components/retro/primitives";
import { getAgent } from "@/lib/agent";
import { FIRMWARE_LABELS } from "@/lib/agent/catalog";
import { SEVERITY_LABEL, SEVERITY_TONE } from "@/components/retro/primitives";
import type { FirmwareId, MigrationPlan } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/migrate")({
  head: () => ({
    meta: [
      { title: "Firmware Migration — RetroCard" },
      {
        name: "description",
        content:
          "Демонстрационный план миграции структуры карты между прошивками ArkOS, JELOS, ROCKNIX и стоковой ОС.",
      },
      { property: "og:title", content: "Firmware Migration — RetroCard" },
      { property: "og:description", content: "План переноса структуры между прошивками ретро-консолей." },
    ],
  }),
  component: MigratePage,
});

const OPTIONS: FirmwareId[] = ["arkos", "jelos", "rocknix", "stock"];

function MigratePage() {
  const [from, setFrom] = useState<FirmwareId>("stock");
  const [to, setTo] = useState<FirmwareId>("arkos");
  const [plan, setPlan] = useState<MigrationPlan | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="rc-rise space-y-4">
      <SectionTitle hint="демо-режим: изменения не применяются">
        FIRMWARE <span className="text-magenta">MIGRATION</span>
      </SectionTitle>

      <Panel title="Направление миграции" subtitle="Откуда и куда переносим структуру">
        <div className="grid gap-4 px-4 py-4 md:grid-cols-2">
          <div>
            <Label>Текущая прошивка</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {OPTIONS.map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setFrom(f);
                    setPlan(null);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest",
                    from === f ? "border-amber/45 bg-amber/12 text-amber" : "border-edge bg-panel-2 text-ink/50",
                  )}
                >
                  {FIRMWARE_LABELS[f]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Целевая прошивка</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {OPTIONS.map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setTo(f);
                    setPlan(null);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest",
                    to === f ? "border-cyan/45 bg-cyan/12 text-cyan" : "border-edge bg-panel-2 text-ink/50",
                  )}
                >
                  {FIRMWARE_LABELS[f]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-edge px-4 py-3">
          <RetroButton
            disabled={busy || from === to}
            onClick={async () => {
              setBusy(true);
              setPlan(await getAgent().buildMigrationPlan(from, to));
              setBusy(false);
            }}
          >
            {from === to ? "Выберите разные прошивки" : busy ? "Построение плана…" : "Построить план миграции"}
          </RetroButton>
        </div>
      </Panel>

      {plan && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Шагов" value={plan.steps.length} />
            <StatCard label="Изменений папок" value={plan.folderChanges.length} tone="cyan" />
            <StatCard label="Предупреждений" value={plan.warnings.length} tone="magenta" />
          </div>

          <Panel title="Шаги" subtitle={`${FIRMWARE_LABELS[plan.from]} → ${FIRMWARE_LABELS[plan.to]}`}>
            <ol className="divide-y divide-edge">
              {plan.steps.map((step, i) => (
                <li key={step.title} className="flex gap-3 px-4 py-3">
                  <span className="font-display text-lg text-magenta/70">{String(i + 1).padStart(2, "0")}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-ink">{step.title}</p>
                      <Tag tone={SEVERITY_TONE[step.risk]}>{SEVERITY_LABEL[step.risk]}</Tag>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] leading-relaxed text-ink/45">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Изменения структуры папок">
            <ul className="divide-y divide-edge">
              {plan.folderChanges.map((c) => (
                <li key={`${c.from}-${c.to}`} className="px-4 py-2.5">
                  <p className="font-mono text-[11px] text-ink/70">
                    <span className="text-amber/80">{c.from}</span>
                    <span className="px-2 text-ink/30">→</span>
                    <span className="text-cyan">{c.to}</span>
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-ink/40">{c.note}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Предупреждения">
            <ul className="divide-y divide-edge">
              {plan.warnings.map((w) => (
                <li key={w} className="px-4 py-2.5 font-mono text-[11px] leading-relaxed text-amber/80">
                  · {w}
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </div>
  );
}

void SECTION_NOOP;
