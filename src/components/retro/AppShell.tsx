/** Оболочка приложения: боковая навигация, статус-лента, прогресс операций. */
import { Link } from "@tanstack/react-router";
import {
  Archive,
  Boxes,
  BrushCleaning,
  Copy,
  Cpu,
  FolderTree,
  Gauge,
  HardDriveDownload,
  Library,
  Settings,
  Shuffle,
  Wand2,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useRetroCard } from "@/lib/agent/agent-context";
import { FIRMWARE_LABELS } from "@/lib/agent/catalog";
import { HEALTH_LABELS, HEALTH_TONE, ProgressBar, RetroButton } from "./primitives";

const NAV = [
  { to: "/", label: "Дашборд", icon: Gauge },
  { to: "/analyzer", label: "Анализ карты", icon: FolderTree },
  { to: "/library", label: "Библиотека", icon: Library },
  { to: "/organizer", label: "Организация", icon: Wand2 },
  { to: "/duplicates", label: "Дубликаты", icon: Copy },
  { to: "/bios", label: "BIOS", icon: Cpu },
  { to: "/cleaner", label: "Очистка", icon: BrushCleaning },
  { to: "/backup", label: "Бэкапы", icon: Archive },
  { to: "/setup", label: "Новая карта", icon: HardDriveDownload },
  { to: "/migrate", label: "Миграция", icon: Shuffle },
  { to: "/settings", label: "Настройки", icon: Settings },
] as const;

function AgentPill() {
  const { status, connect, disconnect } = useRetroCard();
  const connected = status.state === "connected";
  const connecting = status.state === "connecting";

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 rounded-full border border-edge bg-panel/70 px-3 py-1.5">
        <span
          className={cn(
            "size-2 rounded-full",
            connected ? "bg-leaf" : connecting ? "animate-pulse bg-amber" : "bg-ink/25",
          )}
        />
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-widest",
            connected ? "text-leaf" : connecting ? "text-amber" : "text-ink/45",
          )}
        >
          Local Agent · {connected ? "Connected" : connecting ? "Connecting" : "Disconnected"}
        </span>
      </div>
      <RetroButton
        variant={connected ? "outline" : "primary"}
        onClick={() => (connected ? disconnect() : connect())}
        disabled={connecting}
        className="px-3 py-1.5 text-sm"
      >
        {connected ? "Отключить" : connecting ? "Подключение…" : "Connect"}
      </RetroButton>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { scan, progress, status, mode } = useRetroCard();

  return (
    <div className="min-h-screen bg-canvas font-body text-ink">
      <div className="flex min-h-screen">
        {/* Боковая навигация — desktop */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-edge bg-sidebar lg:flex">
          <Link to="/" className="flex items-center gap-2 px-4 py-4">
            <span className="grid size-8 place-items-center rounded-md bg-magenta font-display text-lg leading-none text-canvas">
              R
            </span>
            <span className="leading-none">
              <span className="block font-display text-xl tracking-wide">RETROCARD</span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.3em] text-ink/40">
                sd manager · v0.1
              </span>
            </span>
          </Link>

          <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink/55 transition-colors hover:bg-panel hover:text-ink"
                activeProps={{ className: "bg-panel !text-ink border border-edge" }}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.6} />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </nav>

          <div className="border-t border-edge px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink/35">
              {scan ? `${scan.card.label} · ${FIRMWARE_LABELS[scan.card.firmware.id]}` : "Карта не подключена"}
            </p>
            {scan && (
              <p className={cn("mt-1 font-display text-lg leading-none", HEALTH_TONE[scan.card.health])}>
                {HEALTH_LABELS[scan.card.health]}
              </p>
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Статус-лента */}
          <header className="sticky top-0 z-30 border-b border-edge bg-canvas/95 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <Link to="/" className="flex items-center gap-2 lg:hidden">
                <span className="grid size-8 place-items-center rounded-md bg-magenta font-display text-lg leading-none text-canvas">
                  R
                </span>
                <span className="font-display text-xl tracking-wide">RETROCARD</span>
              </Link>
              <p className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-ink/40 lg:block">
                {scan
                  ? `${scan.card.mountPath} · ${scan.card.fileSystem} · ${FIRMWARE_LABELS[scan.card.firmware.id]} ${scan.card.firmware.version ?? ""}`
                  : status.message}
              </p>
              <AgentPill />
            </div>

            {/* Горизонтальная навигация — мобильные/планшеты */}
            <nav className="flex gap-1 overflow-x-auto px-3 pb-2 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {NAV.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  activeOptions={{ exact: to === "/" }}
                  className="shrink-0 rounded-md border border-transparent px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ink/45"
                  activeProps={{ className: "border-edge bg-panel !text-magenta" }}
                >
                  {label}
                </Link>
              ))}
            </nav>

            {progress && (
              <div className="border-t border-edge bg-panel/60 px-4 py-2">
                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-ink/60">
                  <span className="truncate">{progress.message}</span>
                  <span className="text-cyan">{progress.percent}%</span>
                </div>
                <ProgressBar value={progress.percent} className="mt-1.5 h-1.5" tone="cyan" />
              </div>
            )}
          </header>

          <main className="flex-1 px-3 py-4 md:px-6 md:py-6">
            <div className="mx-auto w-full max-w-[1400px] space-y-4">{children}</div>
          </main>

          <footer className="border-t border-edge px-4 py-4 md:px-6">
            <div className="mx-auto flex max-w-[1400px] flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-[0.2em] text-ink/30">
              <span>Agent · {status.state}</span>
              <span>Transport · {status.transport}</span>
              <span>{scan ? `${scan.summary.romCount} ROM найдено` : "Сканирование не выполнено"}</span>
              <span>RetroCard · {mode === "local" ? "локальный агент" : "демо-данные"}</span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
