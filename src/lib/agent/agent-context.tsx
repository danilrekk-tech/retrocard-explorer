/**
 * Глобальное состояние RetroCard: соединение с помощником, результат
 * сканирования, текущий план организации, прогресс операций.
 *
 * UI-компоненты используют только этот хук и не знают о реализации агента.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { getAgent, resetAgent } from "./index";
import { HttpAgentClient, type AgentDrive } from "./http-agent";
import {
  getAgentMode,
  getAgentUrl,
  setAgentMode,
  setAgentUrl,
  type AgentMode,
} from "./mode";
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
  const [mode, setMode] = useState<AgentMode>("demo");
  const [agentUrl, setUrl] = useState<string>(getAgentUrl());
  // Меняется при смене режима/адреса, чтобы пересоздать клиента.
  const [revision, setRevision] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  const agent = useMemo(() => {
    resetAgent();
    return getAgent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, mode, agentUrl, hydrated]);

  const [status, setStatus] = useState<AgentStatus>(() => agent.getStatus());
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [plan, setPlan] = useState<OrganizationPlan | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [lastResult, setLastResult] = useState<OperationResult | null>(null);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [drives, setDrives] = useState<AgentDrive[]>([]);

  // Настройки читаем только на клиенте (SSR не имеет localStorage).
  useEffect(() => {
    setMode(getAgentMode());
    setUrl(getAgentUrl());
    setHydrated(true);
  }, []);

  useEffect(() => {
    setStatus(agent.getStatus());
    return agent.subscribe(setStatus);
  }, [agent]);

  const scanCard = useCallback(async () => {
    setStage("scanning");
    setProgress({ phase: "start", percent: 0, message: "Инициализация сканирования…" });
    try {
      const result = await agent.scanCard(setProgress);
      setScan(result);
      setStage("ready");
    } catch (err) {
      setStage("idle");
      setStatus({
        ...agent.getStatus(),
        state: "error",
        message: err instanceof Error ? err.message : "Сканирование не удалось",
      });
    } finally {
      setProgress(null);
    }
  }, [agent]);

  const connect = useCallback(async () => {
    const next = await agent.connect();
    if (next.state === "connected") await scanCard();
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
      if (mode === "local") {
        // Реальный агент: перечитываем карту после изменений.
        await scanCard();
        return;
      }
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
    [agent, scan, mode, scanCard],
  );

  const discardPlan = useCallback(() => setPlan(null), []);

  // Демо-режим: карта подключается автоматически, чтобы сервис можно было
  // открыть и сразу протестировать на демонстрационной SD-карте.
  useEffect(() => {
    if (!hydrated || mode !== "demo") return;
    let cancelled = false;
    if (agent.getStatus().state !== "disconnected") return;
    const timer = setTimeout(() => {
      if (!cancelled) void connect();
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent, hydrated, mode]);

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
      if (mode === "local") await scanCard();
      return result;
    },
    [agent, mode, scanCard],
  );

  const resetSession = useCallback(() => {
    setScan(null);
    setPlan(null);
    setStage("idle");
    setLastResult(null);
    setBackups([]);
    setDrives([]);
  }, []);

  const switchMode = useCallback(
    (next: AgentMode) => {
      setAgentMode(next);
      setMode(next);
      resetSession();
      setRevision((r) => r + 1);
    },
    [resetSession],
  );

  const updateAgentUrl = useCallback(
    (url: string) => {
      setAgentUrl(url);
      setUrl(getAgentUrl());
      resetSession();
      setRevision((r) => r + 1);
    },
    [resetSession],
  );

  const checkAgent = useCallback(async () => {
    if (!(agent instanceof HttpAgentClient)) return null;
    try {
      return await agent.ping();
    } catch (err) {
      setStatus({
        ...agent.getStatus(),
        state: "error",
        message:
          err instanceof Error
            ? err.message
            : "RetroCard Local Agent не отвечает. Запустите приложение на компьютере.",
      });
      return null;
    }
  }, [agent]);

  const refreshDrives = useCallback(async () => {
    if (!(agent instanceof HttpAgentClient)) {
      setDrives([]);
      return [];
    }
    try {
      const list = await agent.listDrives();
      setDrives(list);
      return list;
    } catch {
      setDrives([]);
      return [];
    }
  }, [agent]);

  const connectDrive = useCallback(
    async (path: string) => {
      if (!(agent instanceof HttpAgentClient)) return;
      const next = await agent.connect({ path });
      if (next.state === "connected") await scanCard();
    },
    [agent, scanCard],
  );

  const value: RetroCardState = {
    status,
    scan,
    plan,
    stage,
    progress,
    lastResult,
    backups,
    mode,
    agentUrl,
    drives,
    connect,
    disconnect,
    scanCard,
    buildPlan,
    applyPlan,
    discardPlan,
    refreshBackups,
    createBackup,
    deletePaths,
    switchMode,
    updateAgentUrl,
    checkAgent,
    refreshDrives,
    connectDrive,
  };

  return <RetroCardContext.Provider value={value}>{children}</RetroCardContext.Provider>;
}
