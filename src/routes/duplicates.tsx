import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { RequireScan } from "@/components/retro/RequireScan";
import {
  Label,
  Panel,
  RetroButton,
  SectionTitle,
  StatCard,
  SystemBadge,
  Tag,
} from "@/components/retro/primitives";
import { useRetroCard } from "@/lib/agent/agent-context";
import type { DuplicateKind } from "@/lib/agent/types";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/duplicates")({
  head: () => ({
    meta: [
      { title: "Duplicate Finder — RetroCard" },
      {
        name: "description",
        content:
          "Поиск точных дубликатов, похожих игр, разных версий и регионов. RetroCard ничего не удаляет автоматически.",
      },
      { property: "og:title", content: "Duplicate Finder — RetroCard" },
      { property: "og:description", content: "Дубликаты и варианты игр с выбором того, что удалить." },
    ],
  }),
  component: DuplicatesPage,
});

const KIND_LABEL: Record<DuplicateKind, string> = {
  exact: "Точные дубликаты",
  similar: "Похожие игры",
  version: "Разные версии",
  region: "Разные регионы",
};

const KIND_TONE: Record<DuplicateKind, "magenta" | "amber" | "cyan" | "leaf"> = {
  exact: "magenta",
  similar: "amber",
  version: "cyan",
  region: "leaf",
};

function DuplicatesPage() {
  const { deletePaths } = useRetroCard();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<DuplicateKind | "all">("all");
  const [busy, setBusy] = useState(false);

  const toggle = (path: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <RequireScan>
      {(scan) => {
        const groups = scan.duplicates.filter((g) => filter === "all" || g.kind === filter);
        const reclaimable = scan.duplicates.reduce((s, g) => s + g.reclaimableBytes, 0);

        return (
          <div className="rc-rise space-y-4">
            <SectionTitle hint={`${scan.duplicates.length} групп · до ${formatBytes(reclaimable)} освободится`}>
              DUPLICATE <span className="text-magenta">FINDER</span>
            </SectionTitle>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {(["exact", "similar", "version", "region"] as DuplicateKind[]).map((kind) => (
                <StatCard
                  key={kind}
                  label={KIND_LABEL[kind]}
                  value={scan.duplicates.filter((g) => g.kind === kind).length}
                  hint={formatBytes(
                    scan.duplicates.filter((g) => g.kind === kind).reduce((s, g) => s + g.reclaimableBytes, 0),
                  )}
                  tone={kind === "exact" ? "magenta" : kind === "similar" ? "amber" : kind === "version" ? "cyan" : "leaf"}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {(["all", "exact", "similar", "version", "region"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={cn(
                    "rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors",
                    filter === k ? "border-magenta/40 bg-magenta/12 text-magenta" : "border-edge bg-panel text-ink/50",
                  )}
                >
                  {k === "all" ? "Все группы" : KIND_LABEL[k]}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {groups.map((group) => (
                <Panel
                  key={group.id}
                  title={group.title}
                  subtitle={`${group.items.length} файла · освободится ${formatBytes(group.reclaimableBytes)}`}
                  action={
                    <div className="flex items-center gap-2">
                      <SystemBadge systemId={group.systemId} className="size-7 text-sm" />
                      <Tag tone={KIND_TONE[group.kind]}>{KIND_LABEL[group.kind]}</Tag>
                    </div>
                  }
                >
                  <ul className="divide-y divide-edge">
                    {group.items.map((item) => {
                      const path = `${item.path}/${item.fileName}`;
                      return (
                        <li key={path} className="flex items-center gap-3 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(path)}
                            onChange={() => toggle(path)}
                            className="size-3.5 accent-magenta"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-[11px] text-ink/80">{item.fileName}</p>
                            <p className="truncate font-mono text-[10px] text-ink/40">
                              {item.path} · {item.label}
                            </p>
                          </div>
                          <Tag>{item.region ?? "UNK"}</Tag>
                          <span className="w-20 shrink-0 text-right font-mono text-[10px] text-ink/50">
                            {formatBytes(item.sizeBytes)}
                          </span>
                          {item.recommendedKeep ? <Tag tone="leaf">оставить</Tag> : <Tag tone="amber">кандидат</Tag>}
                        </li>
                      );
                    })}
                  </ul>
                </Panel>
              ))}
            </div>

            <Panel title="Удаление выбранного" subtitle="Автоматических удалений нет — только ваш выбор">
              <div className="flex flex-wrap items-center gap-3 px-4 py-4">
                <Label>{selected.size} файлов отмечено</Label>
                <RetroButton
                  variant="danger"
                  disabled={selected.size === 0 || busy}
                  onClick={async () => {
                    setBusy(true);
                    const result = await deletePaths([...selected]);
                    setBusy(false);
                    setSelected(new Set());
                    toast.success(`Удалено файлов: ${result?.applied ?? 0}`);
                  }}
                >
                  Удалить отмеченные
                </RetroButton>
                <RetroButton variant="ghost" onClick={() => setSelected(new Set())}>
                  Сбросить выбор
                </RetroButton>
              </div>
            </Panel>
          </div>
        );
      }}
    </RequireScan>
  );
}
