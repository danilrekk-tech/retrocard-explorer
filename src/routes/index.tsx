import { createFileRoute, Link } from "@tanstack/react-router";

import { useRetroCard } from "@/lib/agent/agent-context";
import { FIRMWARE_LABELS } from "@/lib/agent/catalog";
import { formatBytes, formatDuration, formatNumber, formatPercent } from "@/lib/format";
import {
  HEALTH_LABELS,
  HEALTH_TONE,
  Label,
  Panel,
  ProgressBar,
  RetroButton,
  SEVERITY_LABEL,
  SEVERITY_TONE,
  StatCard,
  SystemBadge,
  Tag,
} from "@/components/retro/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Дашборд SD-карты — RetroCard" },
      {
        name: "description",
        content:
          "Состояние microSD-карты ретро-консоли: объём, игры, системы, BIOS, сохранения, обложки и найденные проблемы.",
      },
      { property: "og:title", content: "Дашборд SD-карты — RetroCard" },
      {
        property: "og:description",
        content: "Индикатор состояния карты, статистика коллекции и план организации файлов.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { scan, status, stage, connect, scanCard, plan, buildPlan, progress } = useRetroCard();

  const connected = status.state === "connected";

  if (!scan) {
    return (
      <div className="rc-rise space-y-4">
        <HeroConnect />
        <Panel title="С чего начать" subtitle="Сценарий: Connect → Scan → Analyze → Organize">
          <ol className="divide-y divide-edge">
            {[
              ["01", "Подключите локального помощника", "Пока используется демо-режим с реалистичными данными."],
              ["02", "Просканируйте карту", "RetroCard определит прошивку, игры, BIOS и структуру папок."],
              ["03", "Разберите проблемы", "Файлы вне папок, дубликаты, отсутствующие BIOS."],
              ["04", "Примените план организации", "Сначала предпросмотр, изменения — только после подтверждения."],
            ].map(([n, title, detail]) => (
              <li key={n} className="flex gap-4 px-4 py-3.5">
                <span className="font-display text-2xl leading-none text-magenta">{n}</span>
                <div>
                  <p className="text-sm text-ink">{title}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-ink/45">{detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
        <div className="flex flex-wrap gap-2">
          <RetroButton onClick={connect} disabled={stage === "scanning" || status.state === "connecting"}>
            {connected ? "Сканировать карту" : "Connect Local Agent"}
          </RetroButton>
          {connected && (
            <RetroButton variant="outline" onClick={scanCard} disabled={stage === "scanning"}>
              Повторить сканирование
            </RetroButton>
          )}
        </div>
      </div>
    );
  }

  const { card, summary } = scan;
  const usedPercent = (card.usedBytes / card.capacityBytes) * 100;

  return (
    <div className="rc-rise space-y-4">
      {/* Hero: здоровье карты */}
      <section className="rc-grain relative overflow-hidden rounded-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-magenta via-coral to-amber" />
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/25 to-transparent" />
        <div className="absolute -right-8 -bottom-10 size-48 rounded-full bg-cyan/40 blur-2xl" />
        <div className="rc-scanline" />
        <div className="relative px-5 pt-5 pb-4 md:px-8 md:pt-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-ink/70">
              Anbernic RG353V · {card.label}
            </p>
            <span className="rounded-full bg-canvas/40 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-ink/90">
              {FIRMWARE_LABELS[card.firmware.id]} {card.firmware.version}
            </span>
          </div>
          <h1 className="mt-3 font-display text-[52px] leading-[0.82] text-canvas md:text-[76px]">
            <span className="block">SD CARD</span>
            <span className="block text-ink">HEALTH</span>
          </h1>
          <div className="mt-3 flex items-center gap-2">
            <span
              className={cn(
                "size-2.5 rounded-full",
                card.health === "good" ? "bg-leaf" : card.health === "warning" ? "bg-amber" : "bg-magenta",
              )}
            />
            <p className="font-display text-2xl tracking-wide text-ink">
              STATUS <span className={HEALTH_TONE[card.health]}>{HEALTH_LABELS[card.health]}</span>
            </p>
          </div>
        </div>
        <div className="relative px-5 pb-5 md:px-8">
          <div className="flex flex-wrap justify-between gap-2 font-mono text-[10px] uppercase tracking-widest text-ink/80">
            <span>{formatBytes(card.capacityBytes, 0)}</span>
            <span>
              {formatPercent(usedPercent)} занято · {formatBytes(card.freeBytes)} свободно
            </span>
          </div>
          <ProgressBar value={usedPercent} className="mt-2" />
          <div className="mt-2 flex flex-wrap gap-2">
            <Tag tone="cyan">чтение {card.readSpeedMbs} МБ/с</Tag>
            <Tag tone="amber">запись {card.writeSpeedMbs} МБ/с</Tag>
            <Tag>{card.fileSystem} · {card.mountPath}</Tag>
            <Tag>скан {formatDuration(summary.durationMs)}</Tag>
          </div>
        </div>
      </section>

      {/* Статистика */}
      <section className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Games" value={formatNumber(summary.romCount)} hint={`в ${summary.systemCount} системах`} />
        <StatCard label="Systems" value={summary.systemCount} hint="папок с играми" />
        <StatCard
          label="BIOS"
          value={
            <>
              {summary.biosFound}
              <span className="ml-1 text-lg text-amber">/{summary.biosFound + summary.biosMissing}</span>
            </>
          }
          hint={`${summary.biosMissing} отсутствует`}
          tone="ink"
        />
        <StatCard label="Saves" value={formatNumber(summary.saveCount)} hint="сохранений и стейтов" />
        <StatCard label="Artwork" value={formatNumber(summary.artworkCount)} hint="обложек найдено" />
        <StatCard label="Unknown" value={summary.unknownCount} hint="неизвестных файлов" tone="amber" />
        <StatCard label="Problems" value={summary.problemCount} hint="требует внимания" tone="magenta" />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        {/* Предпросмотр организации */}
        <Panel
          title={
            <>
              ORGANIZE <span className="text-magenta">PREVIEW</span>
            </>
          }
          subtitle={plan ? `${plan.moves.length} операций в плане` : "План ещё не построен"}
          action={
            plan ? (
              <Link to="/organizer">
                <RetroButton variant="outline" className="px-3 py-1.5 text-sm">
                  Открыть план
                </RetroButton>
              </Link>
            ) : (
              <RetroButton variant="outline" className="px-3 py-1.5 text-sm" onClick={buildPlan}>
                Построить план
              </RetroButton>
            )
          }
        >
          {plan ? (
            <ul className="divide-y divide-edge">
              {plan.moves.slice(0, 6).map((move) => (
                <li key={move.id} className="flex items-center gap-3 px-4 py-3">
                  <SystemBadge systemId={move.systemId} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{move.fileName}</p>
                    <p className="truncate font-mono text-[10px] text-ink/40">
                      {move.from} → {move.to}
                    </p>
                  </div>
                  <Tag tone="cyan">{formatBytes(move.sizeBytes)}</Tag>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-8 text-center font-mono text-[11px] text-ink/45">
              Постройте план, чтобы увидеть, куда RetroCard предлагает переместить файлы.
              <br />
              Изменения применяются только после подтверждения.
            </div>
          )}
          {plan && (
            <div className="border-t border-edge px-4 py-3">
              <Link to="/organizer">
                <RetroButton className="w-full">Confirm &amp; Organize</RetroButton>
              </Link>
            </div>
          )}
        </Panel>

        {/* Проблемы */}
        <Panel title="Найденные проблемы" subtitle={`${scan.problems.length} записей`}>
          <ul className="divide-y divide-edge">
            {scan.problems.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-sm text-ink">{p.title}</p>
                  <Tag tone={SEVERITY_TONE[p.severity]}>{SEVERITY_LABEL[p.severity]}</Tag>
                </div>
                <p className="mt-1 font-mono text-[10px] leading-relaxed text-ink/45">{p.detail}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {progress && (
        <Panel title="Операция выполняется" subtitle={progress.message}>
          <div className="px-4 py-4">
            <ProgressBar value={progress.percent} tone="cyan" />
          </div>
        </Panel>
      )}
    </div>
  );
}

function HeroConnect() {
  const { status } = useRetroCard();
  return (
    <section className="rc-grain relative overflow-hidden rounded-2xl">
      <div className="absolute inset-0 bg-gradient-to-br from-magenta via-coral to-amber" />
      <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/30 to-transparent" />
      <div className="rc-scanline" />
      <div className="relative px-5 py-7 md:px-8 md:py-10">
        <Label className="!text-canvas/70">Anbernic RG353V · demo card</Label>
        <h1 className="mt-3 font-display text-[52px] leading-[0.82] text-canvas md:text-[76px]">
          <span className="block">RETROCARD</span>
          <span className="block text-ink">SD MANAGER</span>
        </h1>
        <p className="mt-3 max-w-xl font-mono text-[11px] leading-relaxed text-ink/80">
          Приведите microSD-карту ретро-консоли в порядок: анализ структуры, библиотека игр, BIOS,
          дубликаты и безопасная организация файлов. {status.message}
        </p>
      </div>
    </section>
  );
}
