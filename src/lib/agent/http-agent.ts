/**
 * HttpAgentClient — реализация LocalAgentClient поверх RetroCard Local Agent
 * (локальный HTTP-сервер на компьютере пользователя, по умолчанию 127.0.0.1:7345).
 *
 * Никакой файловой логики в браузере нет: все операции выполняет агент.
 */
import type {
  AgentConfig,
  AgentStatus,
  BrowseResult,
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

export const DEFAULT_AGENT_URL = "http://127.0.0.1:7345";

/** Съёмный носитель, найденный агентом. */
export interface AgentDrive {
  path: string;
  label: string;
  capacityBytes: number;
  freeBytes: number;
  removable: boolean;
}

type NdjsonEvent =
  | { type: "progress"; phase: string; percent: number; message: string }
  | { type: "result"; data: unknown }
  | { type: "error"; message: string };

export class HttpAgentClient implements LocalAgentClient {
  private baseUrl: string;
  private status: AgentStatus;
  private listeners = new Set<(status: AgentStatus) => void>();

  constructor(baseUrl: string = DEFAULT_AGENT_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.status = {
      state: "disconnected",
      version: null,
      transport: "http",
      host: this.baseUrl.replace(/^https?:\/\//, ""),
      message: "Локальный помощник не подключён",
    };
  }

  private setStatus(next: AgentStatus) {
    this.status = { ...next, transport: "http", host: this.baseUrl.replace(/^https?:\/\//, "") };
    for (const l of this.listeners) l(this.status);
  }

  private async getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new Error(`Агент ответил ${res.status}: ${res.statusText}`);
    return (await res.json()) as T;
  }

  private async postJson<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const text = await res.text();
    let parsed: unknown = undefined;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch {
      parsed = undefined;
    }
    if (!res.ok) {
      const message =
        (parsed && typeof parsed === "object" && "error" in parsed
          ? String((parsed as { error: unknown }).error)
          : undefined) ?? `Агент ответил ${res.status}`;
      throw new Error(message);
    }
    return parsed as T;
  }

  /** POST с NDJSON-стримом прогресса; резолвится финальным result. */
  private async streamPost<T>(path: string, body: unknown, onProgress?: ProgressCallback): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Агент ответил ${res.status}: ${text}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result: T | undefined;
    let errorMessage: string | undefined;

    for (;;) {
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
    if (result === undefined) throw new Error("Агент вернул пустой ответ операции");
    return result;
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  subscribe(listener: (status: AgentStatus) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Проверка доступности агента без подключения к карте. */
  async ping(): Promise<AgentStatus> {
    const status = await this.getJson<AgentStatus>("/api/status");
    this.setStatus(status);
    return status;
  }

  /** Список найденных агентом съёмных носителей. */
  async listDrives(): Promise<AgentDrive[]> {
    const data = await this.getJson<AgentDrive[] | { drives: AgentDrive[] }>("/api/drives");
    return Array.isArray(data) ? data : (data.drives ?? []);
  }

  /** Список папок карты — для выбора папки ROM'ов вручную. */
  async browse(relativePath = ""): Promise<BrowseResult> {
    return this.postJson<BrowseResult>("/api/browse", { path: relativePath });
  }

  async connect(
    options?: { path?: string; consoleId?: ConsoleId } & Partial<AgentConfig>,
  ): Promise<AgentStatus> {
    this.setStatus({ ...this.status, state: "connecting", message: "Поиск локального помощника…" });
    try {
      const status = await this.postJson<AgentStatus>("/api/connect", options ?? {});
      this.setStatus(status);
      return status;
    } catch (err) {
      const status: AgentStatus = {
        ...this.status,
        state: "error",
        version: null,
        message:
          err instanceof Error
            ? err.message
            : "Не удалось подключиться к RetroCard Local Agent. Запущен ли он?",
      };
      this.setStatus(status);
      return status;
    }
  }

  async disconnect(): Promise<AgentStatus> {
    try {
      const status = await this.postJson<AgentStatus>("/api/disconnect");
      this.setStatus(status);
      return status;
    } catch {
      const status: AgentStatus = {
        ...this.status,
        state: "disconnected",
        version: null,
        message: "Соединение закрыто",
      };
      this.setStatus(status);
      return status;
    }
  }

  listConsoles(): Promise<ConsoleProfile[]> {
    return this.getJson<ConsoleProfile[]>("/api/consoles");
  }

  async scanCard(onProgress?: ProgressCallback, config?: AgentConfig): Promise<ScanResult> {
    const result = await this.streamPost<ScanResult>("/api/scan", config ?? {}, onProgress);
    // Совместимость со старой версией помощника, которая игнорирует ручную
    // прошивку: подставляем выбор пользователя на клиенте.
    if (config && config.firmwareId !== "auto" && result?.card?.firmware && !result.card.firmware.manual) {
      result.card = {
        ...result.card,
        firmware: {
          ...result.card.firmware,
          id: config.firmwareId,
          manual: true,
          confidence: 1,
          evidence: ["Прошивка указана вручную в настройках RetroCard"],
        },
      };
    }
    return result;
  }

  buildOrganizationPlan(scan: ScanResult): Promise<OrganizationPlan> {
    return this.postJson<OrganizationPlan>("/api/organize/plan", { scan });
  }

  applyOrganizationPlan(plan: OrganizationPlan, onProgress?: ProgressCallback): Promise<OperationResult> {
    return this.streamPost<OperationResult>("/api/organize/apply", { plan }, onProgress);
  }

  previewCleanup(scan: ScanResult, filters: CleanerFilters): Promise<CleanerPreview> {
    return this.postJson<CleanerPreview>("/api/cleaner/preview", { scan, filters });
  }

  deletePaths(paths: string[], onProgress?: ProgressCallback): Promise<OperationResult> {
    return this.streamPost<OperationResult>("/api/delete", { paths }, onProgress);
  }

  listBackups(): Promise<BackupEntry[]> {
    return this.getJson<BackupEntry[]>("/api/backups");
  }

  createBackup(includes: string[], onProgress?: ProgressCallback): Promise<BackupEntry> {
    return this.streamPost<BackupEntry>("/api/backup/create", { includes }, onProgress);
  }

  buildSetupPlan(input: {
    consoleId: ConsoleId;
    firmwareId: FirmwareId;
    cardSizeGb: number;
  }): Promise<SetupPlan> {
    return this.postJson<SetupPlan>("/api/setup/plan", input);
  }

  buildMigrationPlan(from: FirmwareId, to: FirmwareId): Promise<MigrationPlan> {
    return this.postJson<MigrationPlan>("/api/migrate/plan", { from, to });
  }
}
