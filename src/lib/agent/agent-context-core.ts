/**
 * Контекст и хук состояния RetroCard вынесены в отдельный модуль без
 * компонентов: иначе React Refresh пересоздаёт объект контекста при
 * горячей перезагрузке и хук перестаёт видеть провайдер.
 */
import { createContext, useContext } from "react";

import type {
  AgentStatus,
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
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  scanCard: () => Promise<void>;
  buildPlan: () => Promise<void>;
  applyPlan: (plan: OrganizationPlan) => Promise<void>;
  discardPlan: () => void;
  refreshBackups: () => Promise<void>;
  createBackup: (includes: string[]) => Promise<void>;
  deletePaths: (paths: string[]) => Promise<OperationResult | null>;
}

export const RetroCardContext = createContext<RetroCardState | null>(null);

export function useRetroCard(): RetroCardState {
  const ctx = useContext(RetroCardContext);
  if (!ctx) throw new Error("useRetroCard должен использоваться внутри RetroCardProvider");
  return ctx;
}
