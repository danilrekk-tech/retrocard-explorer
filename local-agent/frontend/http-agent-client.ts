/**
 * HttpAgentClient — реализация LocalAgentClient поверх RetroCard Local Agent
 * (локальный HTTP-сервер на 127.0.0.1:7345).
 *
 * Как подключить:
 *   1. Скопируйте этот файл в src/lib/agent/http-agent.ts проекта retrocard-explorer.
 *   2. В src/lib/agent/index.ts:
 *
 *        import { HttpAgentClient } from "./http-agent";
 *        // ...
 *        export function getAgent(): LocalAgentClient {
 *          if (!instance) instance = new HttpAgentClient();
 *          return instance;
 *        }
 *
 *      (Можно оставить переключение между Mock/Http через setAgent() —
 *      интерфейс не меняется.)
 */
import type {
  AgentStatus,
  BackupEntry,
  CleanerFilters,
  CleanerPreview,
  ConsoleId,
  ConsoleProfile,
  FirmwareId,
  MigrationPlan,
  OperationResult,
  OrganizationPlan,
  ProgressCallback,
  ScanResult,
  SetupPlan,
} from "./types";
import type { LocalAgentClient } from "./client";

const AGENT_BASE_URL = "http://127.0.0.1:7345";

type NdjsonEvent =
  | { type: "progress"; phase: string; percent: number; message: string }
  | { type: "result"; data: unknown }
  | { type: "error"; message: string };

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${AGENT_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Agent error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${AGENT_BASE_URL}${path}`);
  if (!res.ok) throw new Error(`Agent error ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

/** POST с NDJSON-стримом прогресса; резолвится финальным result. */
async function streamPost<T>(path: string, body: unknown, onProgress?: ProgressCallback): Promise<T> {
  const res = await fetch(`${AGENT_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Agent error ${res.status}: ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | undefined;
  let errorMessage: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const event = JSON.parse(line) as NdjsonEvent;
      if (event.type === "progress") {
        onProgress?.({ phase: event.phase, percent: event.percent, message: event.message });
      } else if (event.type === "result") {
        result = event.data as T;
      } else if (event.type === "error") {
        errorMessage = event.message;
      }
    }
  }

  if (errorMessage) throw new Error(errorMessage);
  if (result === undefined) throw new Error("Agent: пустой ответ операции");
  return result;
}

export class HttpAgentClient implements LocalAgentClient {
  private status: AgentStatus = {
    state: "disconnected",
    version: null,
    transport: "http",
    host: AGENT_BASE_URL.replace("http://", ""),
  };
  private listeners = new Set<(status: AgentStatus) => void>();

  private setStatus(next: AgentStatus) {
    this.status = next;
    for (const l of this.listeners) l(next);
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  subscribe(listener: (status: AgentStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async connect(): Promise<AgentStatus> {
    this.setStatus({ ...this.status, state: "connecting" });
    try {
      const status = await postJson<AgentStatus>("/api/connect", {});
      this.setStatus(status);
      return status;
    } catch (err) {
      const status: AgentStatus = {
        ...this.status,
        state: "error",
        message: err instanceof Error ? err.message : "Не удалось подключиться к RetroCard Local Agent",
      };
      this.setStatus(status);
      return status;
    }
  }

  async disconnect(): Promise<AgentStatus> {
    const status = await postJson<AgentStatus>("/api/disconnect");
    this.setStatus(status);
    return status;
  }

  async listConsoles(): Promise<ConsoleProfile[]> {
    return getJson<ConsoleProfile[]>("/api/consoles");
  }

  async scanCard(onProgress?: ProgressCallback): Promise<ScanResult> {
    return streamPost<ScanResult>("/api/scan", {}, onProgress);
  }

  async buildOrganizationPlan(scan: ScanResult): Promise<OrganizationPlan> {
    return postJson<OrganizationPlan>("/api/organize/plan", { scan });
  }

  async applyOrganizationPlan(plan: OrganizationPlan, onProgress?: ProgressCallback): Promise<OperationResult> {
    return streamPost<OperationResult>("/api/organize/apply", { plan }, onProgress);
  }

  async previewCleanup(scan: ScanResult, filters: CleanerFilters): Promise<CleanerPreview> {
    return postJson<CleanerPreview>("/api/cleaner/preview", { scan, filters });
  }

  async deletePaths(paths: string[], onProgress?: ProgressCallback): Promise<OperationResult> {
    return streamPost<OperationResult>("/api/delete", { paths }, onProgress);
  }

  async listBackups(): Promise<BackupEntry[]> {
    return getJson<BackupEntry[]>("/api/backups");
  }

  async createBackup(includes: string[], onProgress?: ProgressCallback): Promise<BackupEntry> {
    return streamPost<BackupEntry>("/api/backup/create", { includes }, onProgress);
  }

  async buildSetupPlan(input: { consoleId: ConsoleId; firmwareId: FirmwareId; cardSizeGb: number }): Promise<SetupPlan> {
    return postJson<SetupPlan>("/api/setup/plan", input);
  }

  async buildMigrationPlan(from: FirmwareId, to: FirmwareId): Promise<MigrationPlan> {
    return postJson<MigrationPlan>("/api/migrate/plan", { from, to });
  }
}
