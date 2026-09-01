import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { RequireScan } from "@/components/retro/RequireScan";
import {
  Label,
  Panel,
  SectionTitle,
  StatusTag,
  SystemBadge,
  Tag,
} from "@/components/retro/primitives";
import { systemMeta } from "@/lib/agent/catalog";
import type { RomEntry, SystemId } from "@/lib/agent/types";
import { formatBytes, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "ROM Library — RetroCard" },
      {
        name: "description",
        content:
          "Библиотека игр по системам: NES, SNES, Game Boy, GBA, Mega Drive, N64, PlayStation, PSP, Arcade — с размером, форматом, регионом и статусом.",
      },
      { property: "og:title", content: "ROM Library — RetroCard" },
      { property: "og:description", content: "Игры на карте, сгруппированные по системам, с обложками и статусами." },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  const [active, setActive] = useState<SystemId | "all">("all");
  const [query, setQuery] = useState("");

  return (
    <RequireScan>
      {(scan) => {
        const map = new Map<SystemId, RomEntry[]>();
        scan.roms.forEach((rom) => {
          const list = map.get(rom.systemId) ?? [];
          list.push(rom);
          map.set(rom.systemId, list);
        });
        const grouped = [...map.entries()].sort((a, b) => b[1].length - a[1].length);

        const filtered = scan.roms.filter(
          (r) =>
            (active === "all" || r.systemId === active) &&
            (query.trim() === "" ||
              `${r.title} ${r.fileName}`.toLowerCase().includes(query.trim().toLowerCase())),
        );

        const totalBytes = filtered.reduce((s, r) => s + r.sizeBytes, 0);

        return (
          <div className="rc-rise space-y-4">
            <SectionTitle hint={`${formatNumber(scan.roms.length)} игр · ${grouped.length} систем`}>
              ROM <span className="text-magenta">LIBRARY</span>
            </SectionTitle>

            {/* Системы */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActive("all")}
                className={cn(
                  "rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors",
                  active === "all" ? "border-magenta/40 bg-magenta/12 text-magenta" : "border-edge bg-panel text-ink/50",
                )}
              >
                Все · {scan.roms.length}
              </button>
              {grouped.map(([systemId, roms]) => (
                <button
                  key={systemId}
                  onClick={() => setActive(systemId)}
                  className={cn(
                    "rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors",
                    active === systemId
                      ? "border-cyan/40 bg-cyan/12 text-cyan"
                      : "border-edge bg-panel text-ink/50 hover:text-ink",
                  )}
                >
                  {systemMeta(systemId).short} · {roms.length}
                </button>
              ))}
            </div>

            <Panel
              title={active === "all" ? "Все игры" : systemMeta(active).name}
              subtitle={`${filtered.length} файлов · ${formatBytes(totalBytes)}`}
              action={
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск по названию или файлу…"
                  className="w-full max-w-xs rounded-lg border border-edge bg-canvas px-3 py-2 font-mono text-[11px] text-ink placeholder:text-ink/30 focus:border-cyan/50 focus:outline-none"
                />
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-edge">
                      {["Игра", "Система", "Файл", "Размер", "Формат", "Регион", "Artwork", "Статус"].map((h) => (
                        <th key={h} className="px-4 py-2">
                          <Label>{h}</Label>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((rom) => (
                      <tr key={rom.id} className="border-b border-edge/60 transition-colors hover:bg-panel-2">
                        <td className="px-4 py-2.5">
                          <p className="max-w-[220px] truncate text-sm text-ink">{rom.title}</p>
                          {rom.problems.length > 0 && (
                            <p className="max-w-[260px] truncate font-mono text-[10px] text-amber/80">
                              {rom.problems.join(" · ")}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <SystemBadge systemId={rom.systemId} className="size-7 text-sm" />
                            <span className="font-mono text-[10px] text-ink/50">
                              {systemMeta(rom.systemId).short}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="max-w-[220px] truncate font-mono text-[11px] text-ink/70">{rom.fileName}</p>
                          <p className="max-w-[220px] truncate font-mono text-[10px] text-ink/30">{rom.path}</p>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-ink/70">{formatBytes(rom.sizeBytes)}</td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-ink/50">{rom.format}</td>
                        <td className="px-4 py-2.5">
                          <Tag tone={rom.region === "UNK" ? "amber" : "neutral"}>{rom.region ?? "UNK"}</Tag>
                        </td>
                        <td className="px-4 py-2.5">
                          {rom.hasArtwork ? (
                            <Tag tone="leaf">есть</Tag>
                          ) : (
                            <Tag tone="amber">нет</Tag>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusTag status={rom.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        );
      }}
    </RequireScan>
  );
}
