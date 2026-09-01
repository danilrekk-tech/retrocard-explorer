/**
 * Глобальное состояние RetroCard: соединение с помощником, результат
 * сканирования, текущий план организации, прогресс операций.
 *
 * UI-компоненты используют только этот хук и не знают о реализации агента.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { getAgent } from "./index";
import { RetroCardContext, useRetroCard, type RetroCardState, type Stage } from "./agent-context-core";
import type {
  AgentStatus,
  BackupEntry,
  OperationResult,
  OrganizationPlan,
  ProgressEvent,
  ScanResult,
} from "./types";

export { useRetroCard };
export type { RetroCardState, Stage };

export function RetroCardProvider({ children }: { children: ReactNode }) {
  const agent = useMemo(() => getAgent(), []);
  const [status, setStatus] = useState<AgentStatus>(() => agent.getStatus());
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [plan, setPlan] = useState<OrganizationPlan | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [lastResult, setLastResult] = useState<OperationResult | null>(null);
  const [backups, setBackups] = useState<BackupEntry[]>([]);

  useEffect(() => agent.subscribe(setStatus), [agent]);

  const scanCard = useCallback(async () => {
    setStage("scanning");
    setProgress({ phase: "start", percent: 0, message: "Инициализация сканирования…" });
    const result = await agent.scanCard(setProgress);
    setScan(result);
    setStage("ready");
    setProgress(null);
  }, [agent]);

  const connect = useCallback(async () => {
    await agent.connect();
    await scanCard();
  }, [agent, scanCard]);

  const disconnect = useCallback(async () => {
    await agent.disconnect();
    setScan(null);
    setPlan(null);
    setStage("idle");
    setLastResult(null);
  }, [agent]);

  const buildPlan = useCallback(async () => {
    if (!scan) return;
    const next = await agent.buildOrganizationPlan(scan);
    setPlan(next);
  }, [agent, scan]);

  const applyPlan = useCallback(
    async (target: OrganizationPlan) => {
      setStage("organizing");
      const result = await agent.applyOrganizationPlan(target, setProgress);
      setLastResult(result);
      setProgress(null);
      setStage("complete");
      setPlan(null);
      // После применения плана карта пересканируется реальным агентом.
      if (scan) {
        setScan({
          ...scan,
          roms: scan.roms.map((r) => ({ ...r, status: "ok", problems: [] })),
          unknownFiles: [],
          problems: scan.problems.filter((p) => p.category === "bios"),
          summary: { ...scan.summary, problemCount: 1, unknownCount: 0 },
          card: { ...scan.card, health: "good" },
        });
      }
    },
    [agent, scan],
  );

  const discardPlan = useCallback(() => setPlan(null), []);

  const refreshBackups = useCallback(async () => {
    setBackups(await agent.listBackups());
  }, [agent]);

  const createBackup = useCallback(
    async (includes: string[]) => {
      setProgress({ phase: "backup", percent: 0, message: "Запуск резервного копирования…" });
      await agent.createBackup(includes, setProgress);
      setProgress(null);
      await refreshBackups();
    },
    [agent, refreshBackups],
  );

  const deletePaths = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return null;
      setProgress({ phase: "delete", percent: 0, message: "Удаление файлов…" });
      const result = await agent.deletePaths(paths, setProgress);
      setProgress(null);
      setLastResult(result);
      return result;
    },
    [agent],
  );

  const value: RetroCardState = {
    status,
    scan,
    plan,
    stage,
    progress,
    lastResult,
    backups,
    connect,
    disconnect,
    scanCard,
    buildPlan,
    applyPlan,
    discardPlan,
    refreshBackups,
    createBackup,
    deletePaths,
  };

  return <RetroCardContext.Provider value={value}>{children}</RetroCardContext.Provider>;
}
