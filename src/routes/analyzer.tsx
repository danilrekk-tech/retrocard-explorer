import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight, File, Folder } from "lucide-react";
import { useState } from "react";

import { RequireScan } from "@/components/retro/RequireScan";
import {
  Label,
  Panel,
  SEVERITY_LABEL,
  SEVERITY_TONE,
  SectionTitle,
  StatCard,
  StatusDot,
  Tag,
} from "@/components/retro/primitives";
import { FIRMWARE_LABELS } from "@/lib/agent/catalog";
import type { FolderNode } from "@/lib/agent/types";
import { formatBytes, formatNumber, formatPercent } from "@/lib/format";

export const Route = createFileRoute("/analyzer")({
  head: () => ({
    meta: [
      { title: "SD Card Analyzer — RetroCard" },
      {
        name: "description",
        content:
          "Определение прошивки (ArkOS, Stock OS, JELOS, ROCKNIX), структура папок, количество файлов и потенциальные проблемы карты.",
      },
      { property: "og:title", content: "SD Card Analyzer — RetroCard" },
      { property: "og:description", content: "Прошивка, дерево папок и найденные проблемы microSD-карты." },
    ],
  }),
  component: AnalyzerPage,
});

function TreeNode({ node, depth = 0 }: { node: FolderNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 1);
  const isDir = node.kind === "dir";
  const hasChildren = isDir && (node.children?.length ?? 0) > 0;

  return (
    <li>
      <button
        type="button"
        onClick={() => hasChildren && setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-panel-2"
        style={{ paddingLeft: `${16 + depth * 18}px` }}
      >
        {hasChildren ? (
          <ChevronRight
            className={`size-3.5 shrink-0 text-ink/40 transition-transform ${open ? "rotate-90" : ""}`}
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {isDir ? (
          <Folder className="size-3.5 shrink-0 text-amber" strokeWidth={1.6} />
        ) : (
          <File className="size-3.5 shrink-0 text-ink/40" strokeWidth={1.6} />
        )}
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink/80">{node.name}</span>
        {node.fileCount !== undefined && (
          <span className="shrink-0 font-mono text-[10px] text-ink/35">{formatNumber(node.fileCount)} файлов</span>
        )}
        {node.sizeBytes !== undefined && (
          <span className="w-20 shrink-0 text-right font-mono text-[10px] text-ink/45">
            {formatBytes(node.sizeBytes)}
          </span>
        )}
        {node.status && <StatusDot status={node.status} />}
      </button>
      {hasChildren && open && (
        <ul>
          {node.children!.map((child) => (
            <TreeNode key={`${node.name}/${child.name}`} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function AnalyzerPage() {
  return (
    <RequireScan>
      {(scan) => {
        const fw = scan.card.firmware;
        return (
          <div className="rc-rise space-y-4">
            <SectionTitle hint={`просканировано ${formatNumber(scan.summary.totalFiles)} файлов`}>
              SD CARD <span className="text-magenta">ANALYZER</span>
            </SectionTitle>

            <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
              <Panel title="Прошивка" subtitle="Определено по служебным файлам сборки">
                <div className="space-y-3 px-4 py-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <Label>Detected firmware</Label>
                      <p className="mt-1 font-display text-4xl leading-none text-cyan">
                        {FIRMWARE_LABELS[fw.id]}
                      </p>
                    </div>
                    <Tag tone="leaf">версия {fw.version ?? "н/д"}</Tag>
                  </div>
                  <div>
                    <Label>Уверенность</Label>
                    <p className="mt-1 font-mono text-[11px] text-ink/70">{formatPercent(fw.confidence * 100)}</p>
                  </div>
                  <div>
                    <Label>Признаки</Label>
                    <ul className="mt-1 space-y-1">
                      {fw.evidence.map((e) => (
                        <li key={e} className="font-mono text-[10px] text-ink/50">
                          · {e}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-edge pt-3">
                    {(["arkos", "stock", "jelos", "rocknix", "unknown"] as const).map((id) => (
                      <Tag key={id} tone={id === fw.id ? "cyan" : "neutral"}>
                        {FIRMWARE_LABELS[id]}
                      </Tag>
                    ))}
                  </div>
                </div>
              </Panel>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <StatCard label="Всего файлов" value={formatNumber(scan.summary.totalFiles)} />
                <StatCard label="ROM" value={scan.summary.romCount} hint="индексировано" />
                <StatCard label="BIOS" value={scan.summary.biosFound} hint={`${scan.summary.biosMissing} нет`} tone="amber" />
                <StatCard label="Saves" value={scan.summary.saveCount} />
                <StatCard label="Artwork" value={scan.summary.artworkCount} />
                <StatCard label="Unknown" value={scan.summary.unknownCount} tone="magenta" />
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
              <Panel title="Структура папок" subtitle={scan.card.mountPath}>
                <ul className="max-h-[520px] overflow-y-auto py-1">
                  <TreeNode node={scan.tree} />
                </ul>
              </Panel>

              <div className="space-y-4">
                <Panel title="Потенциальные проблемы" subtitle={`${scan.problems.length} записей`}>
                  <ul className="divide-y divide-edge">
                    {scan.problems.map((p) => (
                      <li key={p.id} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-sm">{p.title}</p>
                          <Tag tone={SEVERITY_TONE[p.severity]}>{SEVERITY_LABEL[p.severity]}</Tag>
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-ink/45">{p.detail}</p>
                        <p className="mt-1 font-mono text-[10px] text-ink/30">
                          затронуто объектов: {p.affected} · категория {p.category}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Panel>

                <Panel title="Неизвестные файлы" subtitle={`${scan.unknownFiles.length} шт.`}>
                  <ul className="divide-y divide-edge">
                    {scan.unknownFiles.map((f) => (
                      <li key={f.path} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-[11px] text-ink/80">{f.path}</p>
                          <p className="truncate font-mono text-[10px] text-ink/40">{f.reason}</p>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-ink/45">
                          {formatBytes(f.sizeBytes)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            </div>
          </div>
        );
      }}
    </RequireScan>
  );
}
