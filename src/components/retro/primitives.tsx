/** Базовые визуальные примитивы RetroCard. Только презентация, без логики. */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { systemMeta } from "@/lib/agent/catalog";
import type { AccentToken, HealthStatus, ItemStatus, Severity, SystemId } from "@/lib/agent/types";

const accentText: Record<AccentToken, string> = {
  magenta: "text-magenta",
  cyan: "text-cyan",
  amber: "text-amber",
  coral: "text-coral",
  leaf: "text-leaf",
};

const accentBg: Record<AccentToken, string> = {
  magenta: "bg-magenta/15",
  cyan: "bg-cyan/15",
  amber: "bg-amber/15",
  coral: "bg-coral/15",
  leaf: "bg-leaf/15",
};

export function Panel({
  children,
  className,
  title,
  subtitle,
  action,
}: {
  children?: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={cn("rc-panel overflow-hidden", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-edge px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="font-display text-xl leading-none tracking-wide">{title}</h2>}
            {subtitle && <p className="mt-1 font-mono text-[10px] text-ink/45">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <h1 className="font-display text-4xl leading-none tracking-wide md:text-5xl">{children}</h1>
      {hint && <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">{hint}</p>}
    </div>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("rc-label", className)}>{children}</p>;
}

export function SystemBadge({ systemId, className }: { systemId: SystemId; className?: string }) {
  const meta = systemMeta(systemId);
  return (
    <span
      title={meta.name}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg font-display text-base leading-none",
        accentBg[meta.accent],
        accentText[meta.accent],
        className,
      )}
    >
      {meta.short}
    </span>
  );
}

export function Tag({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "magenta" | "cyan" | "amber" | "coral" | "leaf";
  className?: string;
}) {
  const tones = {
    neutral: "bg-panel-2 text-ink/60 border-edge",
    magenta: "bg-magenta/12 text-magenta border-magenta/25",
    cyan: "bg-cyan/12 text-cyan border-cyan/25",
    amber: "bg-amber/12 text-amber border-amber/25",
    coral: "bg-coral/12 text-coral border-coral/25",
    leaf: "bg-leaf/12 text-leaf border-leaf/25",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wider",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusTone: Record<ItemStatus, "leaf" | "amber" | "magenta"> = {
  ok: "leaf",
  warning: "amber",
  error: "magenta",
};

const statusLabel: Record<ItemStatus, string> = {
  ok: "OK",
  warning: "Внимание",
  error: "Проблема",
};

export function StatusDot({ status, className }: { status: ItemStatus; className?: string }) {
  const color = { ok: "bg-leaf", warning: "bg-amber", error: "bg-magenta" }[status];
  return <span className={cn("size-2 shrink-0 rounded-full", color, className)} />;
}

export function StatusTag({ status, label }: { status: ItemStatus; label?: string }) {
  return (
    <Tag tone={statusTone[status]}>
      <StatusDot status={status} />
      {label ?? statusLabel[status]}
    </Tag>
  );
}

export const HEALTH_LABELS: Record<HealthStatus, string> = {
  good: "GOOD",
  warning: "WARNING",
  critical: "CRITICAL",
};

export const HEALTH_TONE: Record<HealthStatus, string> = {
  good: "text-leaf",
  warning: "text-amber",
  critical: "text-magenta",
};

export const SEVERITY_TONE: Record<Severity, "cyan" | "amber" | "magenta"> = {
  info: "cyan",
  warning: "amber",
  critical: "magenta",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  info: "Инфо",
  warning: "Внимание",
  critical: "Критично",
};

export function ProgressBar({
  value,
  className,
  tone = "spectrum",
}: {
  value: number;
  className?: string;
  tone?: "spectrum" | "cyan" | "magenta" | "amber";
}) {
  const fill = {
    spectrum: "bg-gradient-to-r from-cyan via-leaf to-amber",
    cyan: "bg-cyan",
    magenta: "bg-magenta",
    amber: "bg-amber",
  }[tone];
  return (
    <div className={cn("h-3 w-full overflow-hidden rounded-full bg-canvas/70 ring-1 ring-edge", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", fill)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "ink",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "ink" | "magenta" | "amber" | "cyan" | "leaf";
}) {
  const valueTone = {
    ink: "text-ink",
    magenta: "text-magenta",
    amber: "text-amber",
    cyan: "text-cyan",
    leaf: "text-leaf",
  }[tone];
  return (
    <div className="rc-panel p-3">
      <Label>{label}</Label>
      <p className={cn("mt-1 font-display text-3xl leading-none", valueTone)}>{value}</p>
      {hint && <p className="mt-1 font-mono text-[10px] text-ink/45">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="rc-panel flex flex-col items-center gap-3 px-6 py-14 text-center">
      <p className="font-display text-3xl leading-none tracking-wide text-ink/80">{title}</p>
      <p className="max-w-md font-mono text-[11px] leading-relaxed text-ink/45">{detail}</p>
      {action}
    </div>
  );
}

export function RetroButton({
  children,
  onClick,
  variant = "primary",
  disabled,
  className,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "outline" | "danger";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const variants = {
    primary: "bg-magenta text-canvas hover:bg-magenta/85",
    danger: "bg-coral text-canvas hover:bg-coral/85",
    outline: "border border-edge bg-panel-2 text-ink hover:border-cyan/50 hover:text-cyan",
    ghost: "text-ink/60 hover:text-ink",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-display text-base tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        variants,
        className,
      )}
    >
      {children}
    </button>
  );
}
