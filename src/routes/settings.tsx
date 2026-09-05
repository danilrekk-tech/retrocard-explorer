import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Label, Panel, RetroButton, SectionTitle, StatCard, Tag } from "@/components/retro/primitives";
import { useRetroCard } from "@/lib/agent/agent-context";
import { CONSOLES, FIRMWARE_LABELS, SYSTEMS } from "@/lib/agent/catalog";
import type { BrowseResult, ConsoleId, FirmwareId, SystemId } from "@/lib/agent/types";

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
  const {
    status,
    connect,
    disconnect,
    mode,
    agentUrl,
    drives,
    switchMode,
    updateAgentUrl,
    checkAgent,
    refreshDrives,
    connectDrive,
    config,
    updateConfig,
    browse,
    scanCard,
  } = useRetroCard();
  const [confirmBeforeWrite, setConfirmBeforeWrite] = useState(true);
  const [autoBackup, setAutoBackup] = useState(true);
  const [dryRun, setDryRun] = useState(false);
  const [urlDraft, setUrlDraft] = useState(agentUrl);
  const [busy, setBusy] = useState(false);
  const [browsing, setBrowsing] = useState<BrowseResult | null>(null);
  const [manualPath, setManualPath] = useState("");

  useEffect(() => setUrlDraft(agentUrl), [agentUrl]);

  const connected = status.state === "connected";
  const local = mode === "local";

  const handleCheck = async () => {
    setBusy(true);
    try {
      if (urlDraft.trim() && urlDraft.trim() !== agentUrl) updateAgentUrl(urlDraft);
      const result = await checkAgent();
      if (result && result.state !== "error") {
        toast.success(`Помощник найден${result.version ? ` · v${result.version}` : ""}`);
        await refreshDrives();
      } else {
        toast.error("Помощник не отвечает. Запустите RetroCard Local Agent на компьютере.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rc-rise space-y-4">
      <SectionTitle hint="локальный помощник · безопасность · демо-режим">
        SETTINGS <span className="text-magenta">&amp; AGENT</span>
      </SectionTitle>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard label="Состояние" value={connected ? "Подключен" : "Отключен"} tone={connected ? "leaf" : "magenta"} />
        <StatCard label="Режим" value={local ? "Локальный агент" : "Демо-карта"} tone="cyan" />
        <StatCard label="Версия" value={status.version ?? "—"} tone="amber" />
        <StatCard label="Хост" value={status.host} />
      </div>

      <Panel title="Источник данных" subtitle="демонстрационная карта или реальная SD-карта на вашем ПК">
        <div className="space-y-3 px-4 py-4">
          <div className="flex flex-wrap gap-2">
            <RetroButton variant={local ? "outline" : "primary"} onClick={() => switchMode("demo")}>
              Демо-карта
            </RetroButton>
            <RetroButton variant={local ? "primary" : "outline"} onClick={() => switchMode("local")}>
              RetroCard Local Agent
            </RetroButton>
          </div>
          <p className="max-w-2xl font-mono text-[11px] leading-relaxed text-ink/55">
            Веб-интерфейс не имеет доступа к файловой системе. Чтобы работать с настоящей картой,
            скачайте и запустите приложение <span className="text-cyan">RetroCard Local Agent</span>{" "}
            на компьютере — оно поднимает локальный сервер, к которому подключается этот сайт.
          </p>
        </div>
      </Panel>

      {local && (
        <Panel title="Подключение к помощнику" subtitle="адрес локального сервера и выбор носителя">
          <div className="space-y-4 px-4 py-4">
            <div className="space-y-2">
              <Label>Адрес агента</Label>
              <div className="flex flex-wrap gap-2">
                <input
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  spellCheck={false}
                  className="min-w-[240px] flex-1 border border-edge bg-transparent px-3 py-2 font-mono text-[11px] text-ink/80 outline-none focus:border-cyan"
                  placeholder="http://127.0.0.1:7345"
                />
                <RetroButton onClick={handleCheck} disabled={busy}>
                  {busy ? "Проверка…" : "Проверить связь"}
                </RetroButton>
                <RetroButton variant="outline" onClick={() => void refreshDrives()} disabled={busy}>
                  Обновить носители
                </RetroButton>
              </div>
              {status.message && <p className="font-mono text-[10px] text-ink/40">{status.message}</p>}
            </div>

            <div className="space-y-2 border-t border-edge pt-3">
              <Label>Найденные носители</Label>
              {drives.length === 0 ? (
                <p className="font-mono text-[11px] text-ink/40">
                  Ничего не найдено. Вставьте SD-карту и нажмите «Обновить носители».
                </p>
              ) : (
                <div className="space-y-2">
                  {drives.map((drive) => (
                    <div
                      key={drive.path}
                      className="flex flex-wrap items-center justify-between gap-2 border border-edge px-3 py-2"
                    >
                      <div className="font-mono text-[11px] text-ink/70">
                        <span className="text-cyan">{drive.path}</span> · {drive.label || "без метки"}{" "}
                        <span className="text-ink/40">
                          {Math.round(drive.capacityBytes / 1024 ** 3)} ГБ
                        </span>
                      </div>
                      <RetroButton
                        onClick={async () => {
                          await connectDrive(drive.path);
                          toast.success(`Подключено: ${drive.path}`);
                        }}
                      >
                        Подключить и просканировать
                      </RetroButton>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-edge pt-3">
              <Tag tone={connected ? "leaf" : "magenta"}>
                {connected ? "соединение активно" : "нет соединения"}
              </Tag>
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
                    toast("Запрос на подключение отправлен");
                  }}
                >
                  Автоподключение
                </RetroButton>
              )}
            </div>

            <div className="border-t border-edge pt-3 font-mono text-[10px] leading-relaxed text-ink/40">
              Если связь не устанавливается: убедитесь, что агент запущен, порт{" "}
              <span className="text-ink/60">7345</span> не занят, а брандмауэр разрешает локальные
              подключения.
            </div>
          </div>
        </Panel>
      )}


      {local && (
        <Panel title="Ручные настройки карты" subtitle="прошивка, консоль и папки с ROM'ами">
          <div className="space-y-4 px-4 py-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Операционная система (прошивка)</Label>
                <select
                  value={config.firmwareId}
                  onChange={(e) =>
                    updateConfig({ ...config, firmwareId: e.target.value as FirmwareId | "auto" })
                  }
                  className="w-full border border-edge bg-transparent px-3 py-2 font-mono text-[11px] text-ink/80 outline-none focus:border-cyan"
                >
                  <option value="auto">Определить автоматически</option>
                  {(Object.keys(FIRMWARE_LABELS) as FirmwareId[]).map((id) => (
                    <option key={id} value={id}>
                      {FIRMWARE_LABELS[id]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Консоль</Label>
                <select
                  value={config.consoleId}
                  onChange={(e) => updateConfig({ ...config, consoleId: e.target.value as ConsoleId })}
                  className="w-full border border-edge bg-transparent px-3 py-2 font-mono text-[11px] text-ink/80 outline-none focus:border-cyan"
                >
                  {CONSOLES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.vendor} {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 border-t border-edge pt-3">
              <Label>Папки с ROM'ами</Label>
              <p className="font-mono text-[10px] leading-relaxed text-ink/40">
                Оставьте список пустым — папки будут найдены автоматически. Укажите одну общую папку
                (внутри неё подпапки платформ) либо по одной папке на платформу с выбором системы.
              </p>
              {config.romsPaths.length > 0 && (
                <div className="space-y-2">
                  {config.romsPaths.map((folder, idx) => (
                    <div
                      key={`${folder.path}-${idx}`}
                      className="flex flex-wrap items-center gap-2 border border-edge px-3 py-2"
                    >
                      <span className="flex-1 font-mono text-[11px] text-cyan">{folder.path}</span>
                      <select
                        value={folder.systemId ?? "auto"}
                        onChange={(e) => {
                          const next = [...config.romsPaths];
                          next[idx] = { path: folder.path, systemId: e.target.value as SystemId | "auto" };
                          updateConfig({ ...config, romsPaths: next });
                        }}
                        className="border border-edge bg-transparent px-2 py-1 font-mono text-[10px] text-ink/70 outline-none focus:border-cyan"
                      >
                        <option value="auto">Подпапки платформ (авто)</option>
                        {(Object.keys(SYSTEMS) as SystemId[]).map((id) => (
                          <option key={id} value={id}>
                            {SYSTEMS[id].name}
                          </option>
                        ))}
                      </select>
                      <RetroButton
                        variant="outline"
                        onClick={() =>
                          updateConfig({
                            ...config,
                            romsPaths: config.romsPaths.filter((_, i) => i !== idx),
                          })
                        }
                      >
                        Убрать
                      </RetroButton>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <input
                  value={manualPath}
                  onChange={(e) => setManualPath(e.target.value)}
                  spellCheck={false}
                  placeholder="roms  ·  games  ·  SDCARD/roms"
                  className="min-w-[200px] flex-1 border border-edge bg-transparent px-3 py-2 font-mono text-[11px] text-ink/80 outline-none focus:border-cyan"
                />
                <RetroButton
                  onClick={() => {
                    const value = manualPath.trim().replace(/^[/\\]+|[/\\]+$/g, "");
                    if (!value) return;
                    if (config.romsPaths.some((f) => f.path === value)) {
                      toast("Эта папка уже добавлена");
                      return;
                    }
                    updateConfig({
                      ...config,
                      romsPaths: [...config.romsPaths, { path: value, systemId: "auto" }],
                    });
                    setManualPath("");
                  }}
                >
                  Добавить папку
                </RetroButton>
                <RetroButton
                  variant="outline"
                  onClick={async () => {
                    const result = await browse("");
                    if (!result) {
                      toast.error("Сначала подключите карту через помощника");
                      return;
                    }
                    setBrowsing(result);
                  }}
                >
                  Обзор карты
                </RetroButton>
              </div>

              {browsing && (
                <div className="space-y-2 border border-edge px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-ink/50">
                      /{browsing.path || ""} · файлов: {browsing.fileCount}
                    </span>
                    <div className="flex gap-2">
                      {browsing.parent !== null && (
                        <RetroButton
                          variant="outline"
                          onClick={async () => {
                            const up = await browse(browsing.parent ?? "");
                            if (up) setBrowsing(up);
                          }}
                        >
                          Наверх
                        </RetroButton>
                      )}
                      <RetroButton variant="outline" onClick={() => setBrowsing(null)}>
                        Закрыть
                      </RetroButton>
                    </div>
                  </div>
                  {browsing.path && (
                    <RetroButton
                      onClick={() => {
                        if (!config.romsPaths.some((f) => f.path === browsing.path)) {
                          updateConfig({
                            ...config,
                            romsPaths: [...config.romsPaths, { path: browsing.path, systemId: "auto" }],
                          });
                        }
                        toast.success(`Папка добавлена: ${browsing.path}`);
                      }}
                    >
                      Выбрать эту папку
                    </RetroButton>
                  )}
                  <div className="space-y-1">
                    {browsing.dirs.length === 0 ? (
                      <p className="font-mono text-[10px] text-ink/40">Вложенных папок нет.</p>
                    ) : (
                      browsing.dirs.map((dir) => (
                        <button
                          key={dir.path}
                          type="button"
                          onClick={async () => {
                            const next = await browse(dir.path);
                            if (next) setBrowsing(next);
                          }}
                          className="block w-full text-left font-mono text-[11px] text-ink/70 hover:text-cyan"
                        >
                          {dir.name}
                          <span className="text-ink/35"> · файлов: {dir.fileCount}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-edge pt-3">
              <RetroButton
                onClick={async () => {
                  if (!connected) {
                    toast.error("Сначала подключите карту");
                    return;
                  }
                  await scanCard();
                  toast.success("Карта просканирована с новыми настройками");
                }}
              >
                Пересканировать с настройками
              </RetroButton>
              <RetroButton
                variant="outline"
                onClick={() => {
                  updateConfig({ ...config, firmwareId: "auto", romsPaths: [] });
                  toast("Настройки сброшены к автоопределению");
                }}
              >
                Сбросить
              </RetroButton>
            </div>
          </div>
        </Panel>
      )}

      {!local && (
        <Panel title="Демо-режим" subtitle="виртуальная карта, реальные носители не читаются">
          <div className="flex flex-wrap items-center gap-2 px-4 py-4">
            <Tag tone={connected ? "leaf" : "magenta"}>
              {connected ? "демо-карта подключена" : "нет соединения"}
            </Tag>
            {connected ? (
              <RetroButton
                variant="outline"
                onClick={async () => {
                  await disconnect();
                  toast("Демо-карта отключена");
                }}
              >
                Отключить
              </RetroButton>
            ) : (
              <RetroButton
                onClick={async () => {
                  await connect();
                  toast.success("Демо-карта подключена");
                }}
              >
                Подключить
              </RetroButton>
            )}
          </div>
        </Panel>
      )}


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
