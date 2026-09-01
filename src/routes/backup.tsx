import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import { formatBytes, formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/backup")({
  head: () => ({
    meta: [
      { title: "Backup Center — RetroCard" },
      {
        name: "description",
        content:
          "Резервное копирование сохранений, состояний эмуляторов, конфигураций и BIOS перед любыми изменениями на SD-карте.",
      },
      { property: "og:title", content: "Backup Center — RetroCard" },
      { property: "og:description", content: "Бэкапы сохранений и конфигураций ретро-консоли." },
    ],
  }),
  component: BackupPage,
});

const INCLUDES = [
  { id: "saves", label: "Сохранения (.srm, .sav)" },
  { id: "states", label: "Состояния эмуляторов (save states)" },
  { id: "configs", label: "Конфигурации и настройки" },
  { id: "bios", label: "BIOS-файлы" },
  { id: "artwork", label: "Обложки и скриншоты" },
];

function BackupPage() {
  const { backups, refreshBackups, createBackup, progress, scan } = useRetroCard();
  const [selected, setSelected] = useState<string[]>(["saves", "states", "configs"]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void refreshBackups();
  }, [refreshBackups]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));

  return (
    <div className="rc-rise space-y-4">
      <SectionTitle hint="сначала бэкап — потом изменения">
        BACKUP <span className="text-magenta">CENTER</span>
      </SectionTitle>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard label="Копий" value={backups.length} />
        <StatCard
          label="Общий объём"
          value={formatBytes(backups.reduce((s, b) => s + b.sizeBytes, 0))}
          tone="cyan"
        />
        <StatCard
          label="Сохранений на карте"
          value={scan ? formatNumber(scan.saves.length) : "—"}
          tone="amber"
        />
        <StatCard
          label="Последняя копия"
          value={backups[0] ? formatDateTime(backups[0].createdAt) : "нет"}
          tone="leaf"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Panel title="Новая копия" subtitle="Выберите, что включить в архив">
          <div className="space-y-3 px-4 py-4">
            {INCLUDES.map((inc) => (
              <label key={inc.id} className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={selected.includes(inc.id)}
                  onChange={() => toggle(inc.id)}
                  className="size-3.5 accent-magenta"
                />
                <span className="font-mono text-[11px] text-ink/70">{inc.label}</span>
              </label>
            ))}

            <RetroButton
              className="w-full"
              disabled={busy || selected.length === 0}
              onClick={async () => {
                setBusy(true);
                await createBackup(selected);
                setBusy(false);
                toast.success("Резервная копия создана");
              }}
            >
              {busy ? "Копирование…" : "Создать резервную копию"}
            </RetroButton>

            {progress && (
              <div className="space-y-1.5 border-t border-edge pt-3">
                <Label>{progress.message}</Label>
                <ProgressBar value={progress.percent} tone="cyan" />
              </div>
            )}
          </div>
        </Panel>

        <Panel title="История копий" subtitle={`${backups.length} архивов`}>
          {backups.length === 0 ? (
            <p className="px-4 py-10 text-center font-mono text-[11px] text-ink/45">
              Копий пока нет. Создайте первую перед организацией или очисткой карты.
            </p>
          ) : (
            <ul className="divide-y divide-edge">
              {backups.map((b) => (
                <li key={b.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{b.label}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-ink/40">
                        {formatDateTime(b.createdAt)} · {formatNumber(b.fileCount)} файлов ·{" "}
                        {formatBytes(b.sizeBytes)}
                      </p>
                    </div>
                    <Tag tone={b.status === "complete" ? "leaf" : b.status === "running" ? "amber" : "magenta"}>
                      {b.status === "complete" ? "готово" : b.status === "running" ? "идёт" : "ошибка"}
                    </Tag>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {b.includes.map((inc) => (
                      <span
                        key={inc}
                        className={cn(
                          "rounded-md border border-edge bg-panel-2 px-2 py-0.5",
                          "font-mono text-[9px] uppercase tracking-wider text-ink/45",
                        )}
                      >
                        {inc}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
