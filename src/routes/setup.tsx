import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import {
  Label,
  Panel,
  RetroButton,
  SectionTitle,
  StatCard,
  SystemBadge,
  Tag,
} from "@/components/retro/primitives";
import { getAgent } from "@/lib/agent";
import { CONSOLES, FIRMWARE_LABELS } from "@/lib/agent/catalog";
import type { ConsoleId, FirmwareId, SetupPlan } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Prepare New Card — RetroCard" },
      {
        name: "description",
        content:
          "Мастер подготовки новой SD-карты: выбор консоли, прошивки и объёма, рекомендуемая структура папок и чек-лист перед копированием игр.",
      },
      { property: "og:title", content: "Prepare New Card — RetroCard" },
      { property: "og:description", content: "Пошаговая подготовка чистой SD-карты для ретро-консоли." },
    ],
  }),
  component: SetupPage,
});

const SIZES = [32, 64, 128, 256, 512];

function SetupPage() {
  const [consoleId, setConsoleId] = useState<ConsoleId>("rg353v");
  const [firmwareId, setFirmwareId] = useState<FirmwareId>("arkos");
  const [cardSizeGb, setCardSizeGb] = useState(128);
  const [plan, setPlan] = useState<SetupPlan | null>(null);
  const [busy, setBusy] = useState(false);

  const profile = CONSOLES.find((c) => c.id === consoleId) ?? CONSOLES[0]!;

  return (
    <div className="rc-rise space-y-4">
      <SectionTitle hint="структура папок создаётся только по подтверждению">
        PREPARE <span className="text-magenta">NEW CARD</span>
      </SectionTitle>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
        <div className="space-y-4">
          <Panel title="Шаг 1 · Консоль">
            <div className="space-y-2 px-4 py-4">
              {CONSOLES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setConsoleId(c.id);
                    setPlan(null);
                    if (!c.firmwares.includes(firmwareId)) setFirmwareId(c.firmwares[0]!);
                  }}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2.5 text-left transition-colors",
                    consoleId === c.id
                      ? "border-magenta/45 bg-magenta/10"
                      : "border-edge bg-panel-2 hover:border-edge-strong",
                  )}
                >
                  <p className="text-sm text-ink">{c.name}</p>
                  <p className="font-mono text-[10px] text-ink/40">
                    {c.vendor} · {c.systems.length} систем · {c.romsRoot}
                  </p>
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Шаг 2 · Прошивка">
            <div className="flex flex-wrap gap-2 px-4 py-4">
              {profile.firmwares.map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setFirmwareId(f);
                    setPlan(null);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors",
                    firmwareId === f
                      ? "border-cyan/45 bg-cyan/12 text-cyan"
                      : "border-edge bg-panel-2 text-ink/50",
                  )}
                >
                  {FIRMWARE_LABELS[f]}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Шаг 3 · Объём карты">
            <div className="flex flex-wrap gap-2 px-4 py-4">
              {SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setCardSizeGb(s);
                    setPlan(null);
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors",
                    cardSizeGb === s
                      ? "border-amber/45 bg-amber/12 text-amber"
                      : "border-edge bg-panel-2 text-ink/50",
                  )}
                >
                  {s} ГБ
                </button>
              ))}
            </div>
            <div className="border-t border-edge px-4 py-3">
              <RetroButton
                className="w-full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setPlan(await getAgent().buildSetupPlan({ consoleId, firmwareId, cardSizeGb }));
                  setBusy(false);
                }}
              >
                {busy ? "Расчёт структуры…" : "Показать рекомендуемую структуру"}
              </RetroButton>
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Консоль" value={profile.name} />
            <StatCard label="Прошивка" value={FIRMWARE_LABELS[firmwareId]} tone="cyan" />
            <StatCard label="Объём" value={`${cardSizeGb} ГБ`} tone="amber" />
          </div>

          <Panel title="Поддерживаемые системы" subtitle={`${profile.systems.length} систем на этой консоли`}>
            <div className="flex flex-wrap gap-2 px-4 py-4">
              {profile.systems.map((s) => (
                <SystemBadge key={s} systemId={s} className="size-9" />
              ))}
            </div>
          </Panel>

          {plan ? (
            <>
              <Panel title="Структура папок" subtitle={`${plan.folders.length} папок`}>
                <ul className="max-h-96 divide-y divide-edge overflow-y-auto">
                  {plan.folders.map((f) => (
                    <li key={f.path} className="flex items-center justify-between gap-3 px-4 py-2">
                      <span
                        className="truncate font-mono text-[11px] text-ink/75"
                        style={{ paddingLeft: `${f.depth * 14}px` }}
                      >
                        {f.path}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-ink/35">{f.note}</span>
                    </li>
                  ))}
                </ul>
              </Panel>

              <Panel title="Чек-лист перед копированием">
                <ul className="divide-y divide-edge">
                  {plan.notes.map((n) => (
                    <li key={n} className="flex gap-2.5 px-4 py-2.5">
                      <Tag tone="cyan">·</Tag>
                      <span className="font-mono text-[11px] leading-relaxed text-ink/60">{n}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </>
          ) : (
            <Panel title="Предпросмотр структуры">
              <p className="px-4 py-10 text-center font-mono text-[11px] text-ink/45">
                Выберите консоль, прошивку и объём карты — RetroCard покажет дерево папок и чек-лист.
              </p>
            </Panel>
          )}

          <Panel title="Форматирование">
            <div className="space-y-2 px-4 py-4">
              <Label>Рекомендуемая файловая система</Label>
              <p className="font-mono text-[11px] leading-relaxed text-ink/55">
                exFAT для карт от 64 ГБ, FAT32 для 32 ГБ и меньше. RetroCard не форматирует карту сам —
                используйте системную утилиту, затем вернитесь и создайте структуру папок.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
