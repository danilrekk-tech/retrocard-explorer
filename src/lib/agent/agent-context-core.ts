/**
 * Контекст и хук состояния RetroCard вынесены в отдельный модуль без
 * компонентов: иначе React Refresh пересоздаёт объект контекста при
 * горячей перезагрузке и хук перестаёт видеть провайдер.
 */
import { createContext, useContext } from "react";

import type { AgentDrive } from "./http-agent";
import type { AgentMode } from "./mode";
import type {
  AgentConfig,
  AgentStatus,
  BrowseResult,
  BackupEntry,
  OperationResult,
  OrganizationPlan,
  ProgressEvent,
  ScanResult,
} from "./types";


export type Stage = "idle" | "scanning" | "ready" | "organizing" | "complete";

export interface RetroCardState {
  status: AgentStatus;
  scan: ScanResult | null;
  plan: OrganizationPlan | null;
  stage: Stage;
  progress: ProgressEvent | null;
  lastResult: OperationResult | null;
  backups: BackupEntry[];
  /** Режим: демо-карта или реальный локальный помощник. */
  mode: AgentMode;
  /** Адрес локального помощника (для режима "local"). */
  agentUrl: string;
  /** Съёмные носители, найденные помощником. */
  drives: AgentDrive[];
  /** Ручные настройки: прошивка, консоль, папки ROM'ов. */
  config: AgentConfig;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  scanCard: () => Promise<void>;
  buildPlan: () => Promise<void>;
  applyPlan: (plan: OrganizationPlan) => Promise<void>;
  discardPlan: () => void;
  refreshBackups: () => Promise<void>;
  createBackup: (includes: string[]) => Promise<void>;
  deletePaths: (paths: string[]) => Promise<OperationResult | null>;
  switchMode: (mode: AgentMode) => void;
  updateAgentUrl: (url: string) => void;
  /** Проверить доступность помощника без подключения карты. */
  checkAgent: () => Promise<AgentStatus | null>;
  refreshDrives: () => Promise<AgentDrive[]>;
  /** Подключиться к конкретному носителю и просканировать его. */
  connectDrive: (path: string) => Promise<void>;
  /** Обновить ручные настройки (сохраняются между сессиями). */
  updateConfig: (config: AgentConfig) => void;
  /** Просмотреть папки карты (для выбора папки ROM'ов вручную). */
  browse: (path?: string) => Promise<BrowseResult | null>;
}


export const RetroCardContext = createContext<RetroCardState | null>(null);

export function useRetroCard(): RetroCardState {
  const ctx = useContext(RetroCardContext);
  if (!ctx) throw new Error("useRetroCard должен использоваться внутри RetroCardProvider");
  return ctx;
}
