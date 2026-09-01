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
  Tag,
} from "@/components/retro/primitives";
import { useRetroCard } from "@/lib/agent/agent-context";
import { getAgent } from "@/lib/agent";
import { systemMeta } from "@/lib/agent/catalog";
import type { CleanerFilters, CleanerPreview, RomEntry, SystemId } from "@/lib/agent/types";
import { formatBytes, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cleaner")({
  head: () => ({
    meta: [
      { title: "Collection Cleaner — RetroCard" },
      {
        name: "description",
        content:
          "Очистка коллекции по фильтрам: системы, регионы, языки, дубликаты, неизвестные файлы, обложки и версии игр. Before / After и объём освобождаемого места.",
      },
      { property: "og:title", content: "Collection Cleaner — RetroCard" },
      { property: "og:description", content: "Фильтры очистки с предпросмотром Before / After." },
    ],
  }),
  component: CleanerPage,
});

const REGIONS: Array<NonNullable<RomEntry["region"]>> = ["USA", "EUR", "JPN", "WORLD", "UNK"];
const LANGUAGES = ["en", "ja", "de", "fr"];

function CleanerPage() {
  const { deletePaths, progress } = useRetroCard();
  const [filters, setFilters] = useState<CleanerFilters>({
    systems: [],
    regions: [],
    languages: [],
    removeDuplicates: true,
    removeUnknown: true,
    removeOrphanArtwork: false,
    removeAltVersions: false,
  });
  const [preview, setPreview] = useState<CleanerPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleIn = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <RequireScan>
      {(scan) => {
        const systems = [...new Set(scan.roms.map((r) => r.systemId))] as SystemId[];

        const runPreview = async () => {
          setBusy(true);
          const result = await getAgent().previewCleanup(scan, filters);
          setPreview(result);
          setBusy(false);
        };

        return (
          <div className="rc-rise space-y-4">
            <SectionTitle hint="ничего не удаляется без подтверждения">
              COLLECTION <span className="text-magenta">CLEANER</span>
            </SectionTitle>

            <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
              <Panel title="Фильтры" subtitle="Отметьте, что считать мусором">
                <div className="space-y-4 px-4 py-4">
                  <div>
                    <Label>Исключить системы</Label>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {systems.map((s) => (
                        <button
                          key={s}
                          onClick={() => setFilters((f) => ({ ...f, systems: toggleIn(f.systems, s) }))}
                          className={cn(
                            "rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wider",
                            filters.systems.includes(s)
                              ? "border-magenta/40 bg-magenta/12 text-magenta"
                              : "border-edge bg-panel-2 text-ink/50",
                          )}
                        >
                          {systemMeta(s).short}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Исключить регионы</Label>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {REGIONS.map((r) => (
                        <button
                          key={r}
                          onClick={() => setFilters((f) => ({ ...f, regions: toggleIn(f.regions, r) }))}
                          className={cn(
                            "rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wider",
                            filters.regions.includes(r)
                              ? "border-coral/40 bg-coral/12 text-coral"
                              : "border-edge bg-panel-2 text-ink/50",
                          )}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Исключить языки</Label>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {LANGUAGES.map((l) => (
                        <button
                          key={l}
                          onClick={() => setFilters((f) => ({ ...f, languages: toggleIn(f.languages, l) }))}
                          className={cn(
                            "rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wider",
                            filters.languages.includes(l)
                              ? "border-cyan/40 bg-cyan/12 text-cyan"
                              : "border-edge bg-panel-2 text-ink/50",
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-edge pt-3">
                    {(
                      [
                        ["removeDuplicates", "Дубликаты (точные и похожие)"],
                        ["removeAltVersions", "Альтернативные версии игр"],
                        ["removeUnknown", "Неизвестные файлы"],
                        ["removeOrphanArtwork", "Обложки без игр"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={filters[key]}
                          onChange={() => setFilters((f) => ({ ...f, [key]: !f[key] }))}
                          className="size-3.5 accent-magenta"
                        />
                        <span className="font-mono text-[11px] text-ink/70">{label}</span>
                      </label>
                    ))}
                  </div>

                  <RetroButton onClick={runPreview} disabled={busy} className="w-full">
                    {busy ? "Расчёт…" : "Показать Before / After"}
                  </RetroButton>
                </div>
              </Panel>

              <div className="space-y-4">
                {preview ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                      <StatCard label="Before · файлов" value={formatNumber(preview.before.files)} />
                      <StatCard label="After · файлов" value={formatNumber(preview.after.files)} tone="cyan" />
                      <StatCard label="Освободится" value={formatBytes(preview.freedBytes)} tone="leaf" />
                      <StatCard label="К удалению" value={preview.items.length} tone="magenta" />
                    </div>

                    <Panel title="Before / After" subtitle="Занятое место на карте">
                      <div className="space-y-4 px-4 py-4">
                        <div>
                          <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-ink/50">
                            <span>Before</span>
                            <span>{formatBytes(preview.before.usedBytes)}</span>
                          </div>
                          <ProgressBar
                            value={(preview.before.usedBytes / scan.card.capacityBytes) * 100}
                            tone="magenta"
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-ink/50">
                            <span>After</span>
                            <span>{formatBytes(preview.after.usedBytes)}</span>
                          </div>
                          <ProgressBar
                            value={(preview.after.usedBytes / scan.card.capacityBytes) * 100}
                            tone="cyan"
                            className="mt-1.5"
                          />
                        </div>
                        <Tag tone="leaf">
                          −{formatPercent((preview.freedBytes / scan.card.capacityBytes) * 100, 1)} объёма карты
                        </Tag>
                      </div>
                    </Panel>

                    <Panel title="Файлы к удалению" subtitle={`${preview.items.length} шт.`}>
                      <ul className="max-h-80 divide-y divide-edge overflow-y-auto">
                        {preview.items.map((item) => (
                          <li key={item.path} className="flex items-center gap-3 px-4 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-mono text-[11px] text-ink/80">{item.path}</p>
                              <p className="truncate font-mono text-[10px] text-ink/40">{item.reason}</p>
                            </div>
                            <span className="shrink-0 font-mono text-[10px] text-ink/50">
                              {formatBytes(item.sizeBytes)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap gap-2 border-t border-edge px-4 py-3">
                        <RetroButton
                          variant="danger"
                          disabled={busy || preview.items.length === 0}
                          onClick={async () => {
                            setBusy(true);
                            const result = await deletePaths(preview.items.map((i) => i.path));
                            setBusy(false);
                            setPreview(null);
                            toast.success(`Очистка выполнена: ${result?.applied ?? 0} объектов`);
                          }}
                        >
                          Подтвердить очистку
                        </RetroButton>
                        <RetroButton variant="outline" onClick={() => setPreview(null)}>
                          Отменить
                        </RetroButton>
                      </div>
                    </Panel>
                  </>
                ) : (
                  <Panel title="Предпросмотр" subtitle="Выберите фильтры слева">
                    <p className="px-4 py-10 text-center font-mono text-[11px] text-ink/45">
                      RetroCard покажет, сколько файлов и места освободится, прежде чем что-либо удалять.
                    </p>
                  </Panel>
                )}

                {progress && (
                  <Panel title="Удаление" subtitle={progress.message}>
                    <div className="px-4 py-4">
                      <ProgressBar value={progress.percent} tone="magenta" />
                    </div>
                  </Panel>
                )}
              </div>
            </div>
          </div>
        );
      }}
    </RequireScan>
  );
}
