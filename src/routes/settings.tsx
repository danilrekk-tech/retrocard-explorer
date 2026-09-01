import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Label, Panel, RetroButton, SectionTitle, StatCard, Tag } from "@/components/retro/primitives";
import { useRetroCard } from "@/lib/agent/agent-context";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — RetroCard" },
      {
        name: "description",
        content:
          "Настройки RetroCard: подключение локального помощника, режим демо-данных и правила безопасности при работе с SD-картой.",
      },
      { property: "og:title", content: "Settings — RetroCard" },
      { property: "og:description", content: "Настройки локального помощника и безопасности RetroCard." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { status, connect, disconnect } = useRetroCard();
  const [confirmBeforeWrite, setConfirmBeforeWrite] = useState(true);
  const [autoBackup, setAutoBackup] = useState(true);
  const [dryRun, setDryRun] = useState(false);

  const connected = status.state === "connected";

  return (
    <div className="rc-rise space-y-4">
      <SectionTitle hint="локальный помощник · безопасность · демо-режим">
        SETTINGS <span className="text-magenta">&amp; AGENT</span>
      </SectionTitle>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard label="Состояние" value={connected ? "Подключен" : "Отключен"} tone={connected ? "leaf" : "magenta"} />
        <StatCard label="Транспорт" value={status.transport.toUpperCase()} tone="cyan" />
        <StatCard label="Версия" value={status.version ?? "—"} tone="amber" />
        <StatCard label="Хост" value={status.host} />
      </div>

      <Panel title="Локальный помощник" subtitle="RetroCard Local Agent работает на вашем компьютере">
        <div className="space-y-3 px-4 py-4">
          <p className="max-w-2xl font-mono text-[11px] leading-relaxed text-ink/55">
            Веб-интерфейс не имеет доступа к файловой системе. Все операции с SD-картой выполняет
            локальный помощник, который вы запускаете сами; браузер общается с ним по адресу{" "}
            <span className="text-cyan">{status.host}</span>. Сейчас активен демонстрационный
            режим с виртуальной картой — данные не читаются с реальных носителей.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone={connected ? "leaf" : "magenta"}>{connected ? "соединение активно" : "нет соединения"}</Tag>
            {connected ? (
              <RetroButton
                variant="outline"
                onClick={async () => {
                  await disconnect();
                  toast("Помощник отключён");
                }}
              >
                Отключить помощника
              </RetroButton>
            ) : (
              <RetroButton
                onClick={async () => {
                  await connect();
                  toast.success("Помощник подключён");
                }}
              >
                Подключить помощника
              </RetroButton>
            )}
          </div>
          {status.message && <p className="font-mono text-[10px] text-ink/40">{status.message}</p>}
        </div>
      </Panel>

      <Panel title="Безопасность операций" subtitle="Правила, которые RetroCard соблюдает всегда">
        <div className="space-y-3 px-4 py-4">
          {(
            [
              ["Подтверждение перед записью", confirmBeforeWrite, setConfirmBeforeWrite],
              ["Автоматический бэкап сохранений", autoBackup, setAutoBackup],
              ["Режим «только предпросмотр» (dry run)", dryRun, setDryRun],
            ] as const
          ).map(([label, value, setter]) => (
            <label key={label} className="flex cursor-pointer items-center justify-between gap-4">
              <span className="font-mono text-[11px] text-ink/70">{label}</span>
              <input
                type="checkbox"
                checked={value}
                onChange={() => setter(!value)}
                className="size-3.5 accent-magenta"
              />
            </label>
          ))}
          <p className="border-t border-edge pt-3 font-mono text-[10px] leading-relaxed text-ink/40">
            RetroCard никогда не удаляет и не перемещает файлы без явного подтверждения, не скачивает
            ROM-файлы и BIOS и не содержит ссылок на нелегальные источники.
          </p>
        </div>
      </Panel>

      <Panel title="О сервисе">
        <div className="space-y-2 px-4 py-4">
          <Label>RetroCard MVP</Label>
          <p className="font-mono text-[11px] leading-relaxed text-ink/55">
            Интеллектуальный менеджер SD-карт для ретро-консолей: анализ структуры, определение
            прошивки, организация ROM-файлов, поиск дубликатов, проверка BIOS, очистка коллекции,
            резервные копии и подготовка новых карт.
          </p>
        </div>
      </Panel>
    </div>
  );
}
