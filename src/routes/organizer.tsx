import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { RequireScan } from "@/components/retro/RequireScan";
import {
  Label,
  Panel,
  ProgressBar,
  RetroButton,
  SectionTitle,
  StatCard,
  SystemBadge,
  Tag,
} from "@/components/retro/primitives";
import { useRetroCard } from "@/lib/agent/agent-context";
import { formatBytes, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/organizer")({
  head: () => ({
    meta: [
      { title: "Organize SD Card — RetroCard" },
      {
        name: "description",
        content:
          "Предпросмотр плана организации: RetroCard предлагает, в какие системные папки переместить ROM-файлы. Изменения только после подтверждения.",
      },
      { property: "og:title", content: "Organize SD Card — RetroCard" },
      { property: "og:description", content: "План перемещения файлов с предпросмотром и подтверждением." },
    ],
  }),
  component: OrganizerPage,
});

function OrganizerPage() {
  const { plan, buildPlan, applyPlan, discardPlan, progress, stage, lastResult } = useRetroCard();
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <RequireScan>
      {() => {
        const moves = plan?.moves.filter((m) => !skipped.has(m.id)) ?? [];
        const totalBytes = moves.reduce((s, m) => s + m.sizeBytes, 0);

        return (
          <div className="rc-rise space-y-4">
            <SectionTitle hint={plan ? `${plan.moves.length} предложенных операций` : "план не построен"}>
              ORGANIZE <span className="text-magenta">SD CARD</span>
            </SectionTitle>

            {!plan && stage !== "organizing" && (
              <Panel title="Построить план" subtitle="Анализ текущей структуры и подбор целевых папок">
                <div className="space-y-3 px-4 py-5">
                  <p className="max-w-2xl font-mono text-[11px] leading-relaxed text-ink/55">
                    RetroCard определит систему каждого файла по расширению, имени и расположению, затем
                    предложит целевую папку. Ничего не изменится, пока вы не нажмёте подтверждение.
                  </p>
                  <RetroButton onClick={() => buildPlan()}>Построить план организации</RetroButton>
                </div>
              </Panel>
            )}

            {lastResult && !plan && (
              <Panel title="Операция завершена" subtitle={`${lastResult.applied} операций выполнено`}>
                <div className="space-y-2 px-4 py-4">
                  <Tag tone="leaf">Complete</Tag>
                  <ul className="max-h-48 space-y-1 overflow-y-auto">
                    {lastResult.log.slice(0, 40).map((line) => (
                      <li key={line} className="truncate font-mono text-[10px] text-ink/40">
                        {line}
                      </li>
                    ))}
                  </ul>
                  <RetroButton variant="outline" onClick={() => buildPlan()}>
                    Построить новый план
                  </RetroButton>
                </div>
              </Panel>
            )}

            {plan && (
              <>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <StatCard label="Операций" value={formatNumber(moves.length)} hint={`${skipped.size} исключено`} />
                  <StatCard label="Объём" value={formatBytes(totalBytes)} hint="будет перемещено" tone="cyan" />
                  <StatCard label="Новых папок" value={plan.foldersToCreate.length} tone="amber" />
                  <StatCard label="Предупреждений" value={plan.warnings.length} tone="magenta" />
                </div>

                <Panel
                  title={
                    <>
                      PREVIEW <span className="text-magenta">CHANGES</span>
                    </>
                  }
                  subtitle="Снимите отметку, чтобы исключить файл из плана"
                >
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[820px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-edge">
                          {["", "Файл", "Текущий путь", "Целевой путь", "Размер", "Уверенность", "Причина"].map((h, i) => (
                            <th key={i} className="px-4 py-2">
                              <Label>{h}</Label>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {plan.moves.map((move) => {
                          const off = skipped.has(move.id);
                          return (
                            <tr
                              key={move.id}
                              className={`border-b border-edge/60 transition-colors hover:bg-panel-2 ${off ? "opacity-35" : ""}`}
                            >
                              <td className="px-4 py-2.5">
                                <input
                                  type="checkbox"
                                  checked={!off}
                                  onChange={() => toggle(move.id)}
                                  className="size-3.5 accent-magenta"
                                />
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <SystemBadge systemId={move.systemId} className="size-7 text-sm" />
                                  <span className="max-w-[200px] truncate text-sm">{move.fileName}</span>
                                </div>
                              </td>
                              <td className="max-w-[200px] truncate px-4 py-2.5 font-mono text-[11px] text-ink/45">
                                {move.from}
                              </td>
                              <td className="max-w-[220px] truncate px-4 py-2.5 font-mono text-[11px] text-cyan">
                                {move.to}
                              </td>
                              <td className="px-4 py-2.5 font-mono text-[11px] text-ink/60">
                                {formatBytes(move.sizeBytes)}
                              </td>
                              <td className="px-4 py-2.5">
                                <Tag tone={move.confidence > 0.8 ? "leaf" : move.confidence > 0.5 ? "amber" : "magenta"}>
                                  {Math.round(move.confidence * 100)}%
                                </Tag>
                              </td>
                              <td className="max-w-[240px] truncate px-4 py-2.5 font-mono text-[10px] text-ink/40">
                                {move.reason}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Panel>

                <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
                  <Panel title="Новые папки" subtitle={`${plan.foldersToCreate.length} будет создано`}>
                    <ul className="divide-y divide-edge">
                      {plan.foldersToCreate.map((f) => (
                        <li key={f} className="px-4 py-2 font-mono text-[11px] text-ink/60">
                          {f}
                        </li>
                      ))}
                    </ul>
                  </Panel>
                  <Panel title="Предупреждения" subtitle="Прочитайте перед подтверждением">
                    <ul className="divide-y divide-edge">
                      {plan.warnings.map((w) => (
                        <li key={w} className="px-4 py-2.5 font-mono text-[11px] leading-relaxed text-amber/80">
                          · {w}
                        </li>
                      ))}
                    </ul>
                  </Panel>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <RetroButton
                    disabled={busy || moves.length === 0}
                    onClick={async () => {
                      setBusy(true);
                      await applyPlan({ ...plan, moves });
                      setBusy(false);
                      toast.success(`Организация завершена: ${moves.length} операций`);
                    }}
                  >
                    Confirm &amp; Organize ({moves.length})
                  </RetroButton>
                  <RetroButton
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      discardPlan();
                      setSkipped(new Set());
                      toast("План отменён — карта не изменена");
                    }}
                  >
                    Отменить план
                  </RetroButton>
                </div>
              </>
            )}

            {progress && stage === "organizing" && (
              <Panel title="Выполнение" subtitle={progress.message}>
                <div className="px-4 py-4">
                  <ProgressBar value={progress.percent} tone="magenta" />
                </div>
              </Panel>
            )}
          </div>
        );
      }}
    </RequireScan>
  );
}
