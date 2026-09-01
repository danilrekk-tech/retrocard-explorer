import { createFileRoute } from "@tanstack/react-router";

import { RequireScan } from "@/components/retro/RequireScan";
import { Label, Panel, SectionTitle, StatCard, SystemBadge, Tag } from "@/components/retro/primitives";
import { systemMeta } from "@/lib/agent/catalog";
import { formatBytes } from "@/lib/format";

export const Route = createFileRoute("/bios")({
  head: () => ({
    meta: [
      { title: "BIOS Checker — RetroCard" },
      {
        name: "description",
        content:
          "Проверка BIOS: найденные, отсутствующие и неиспользуемые файлы, а также для каких систем BIOS может потребоваться.",
      },
      { property: "og:title", content: "BIOS Checker — RetroCard" },
      { property: "og:description", content: "Статус BIOS-файлов на карте ретро-консоли." },
    ],
  }),
  component: BiosPage,
});

const STATUS_META = {
  present: { label: "Найден", tone: "leaf" as const },
  missing: { label: "Отсутствует", tone: "magenta" as const },
  unused: { label: "Не используется", tone: "amber" as const },
};

function BiosPage() {
  return (
    <RequireScan>
      {(scan) => {
        const found = scan.bios.filter((b) => b.status === "present");
        const missing = scan.bios.filter((b) => b.status === "missing");
        const unused = scan.bios.filter((b) => b.status === "unused");
        const requiredMissing = missing.filter((b) => b.required);

        return (
          <div className="rc-rise space-y-4">
            <SectionTitle hint="RetroCard не распространяет и не скачивает BIOS">
              BIOS <span className="text-magenta">CHECKER</span>
            </SectionTitle>

            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <StatCard label="Найдено" value={found.length} tone="leaf" />
              <StatCard label="Отсутствует" value={missing.length} tone="magenta" hint={`${requiredMissing.length} обязательных`} />
              <StatCard label="Не используется" value={unused.length} tone="amber" />
              <StatCard
                label="Систем требуют BIOS"
                value={new Set(scan.bios.filter((b) => b.required).map((b) => b.systemId)).size}
                tone="cyan"
              />
            </div>

            {requiredMissing.length > 0 && (
              <Panel title="Требуют внимания" subtitle="Без этих файлов часть игр не запустится">
                <ul className="divide-y divide-edge">
                  {requiredMissing.map((b) => (
                    <li key={b.fileName} className="flex items-center gap-3 px-4 py-3">
                      <SystemBadge systemId={b.systemId} className="size-7 text-sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[11px] text-ink">{b.fileName}</p>
                        <p className="truncate font-mono text-[10px] text-ink/45">{b.note}</p>
                      </div>
                      <Tag tone="magenta">обязателен</Tag>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <Panel title="Все BIOS-файлы" subtitle={`${scan.bios.length} записей`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-edge">
                      {["Файл", "Система", "Статус", "Обязателен", "Размер", "Комментарий"].map((h) => (
                        <th key={h} className="px-4 py-2">
                          <Label>{h}</Label>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {scan.bios.map((b) => (
                      <tr key={b.fileName} className="border-b border-edge/60 hover:bg-panel-2">
                        <td className="px-4 py-2.5 font-mono text-[11px] text-ink/80">{b.fileName}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <SystemBadge systemId={b.systemId} className="size-7 text-sm" />
                            <span className="font-mono text-[10px] text-ink/50">{systemMeta(b.systemId).short}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Tag tone={STATUS_META[b.status].tone}>{STATUS_META[b.status].label}</Tag>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[10px] text-ink/50">{b.required ? "да" : "нет"}</td>
                        <td className="px-4 py-2.5 font-mono text-[10px] text-ink/50">
                          {b.sizeBytes ? formatBytes(b.sizeBytes) : "—"}
                        </td>
                        <td className="max-w-[280px] px-4 py-2.5 font-mono text-[10px] text-ink/40">{b.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Правовая заметка">
              <p className="px-4 py-4 font-mono text-[11px] leading-relaxed text-ink/50">
                RetroCard только проверяет наличие файлов на вашей карте. Сервис не скачивает BIOS,
                не содержит ссылок на нелегальные источники и не предлагает образы игр. Используйте
                файлы, полученные с принадлежащего вам оборудования.
              </p>
            </Panel>
          </div>
        );
      }}
    </RequireScan>
  );
}
