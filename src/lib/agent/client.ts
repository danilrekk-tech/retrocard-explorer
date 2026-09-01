/**
 * Контракт локального помощника (Local Agent).
 *
 * ВАЖНО: UI-компоненты никогда не работают с файлами напрямую.
 * Вся файловая логика живёт за этим интерфейсом. Сейчас его реализует
 * `MockAgentClient` (src/lib/agent/mock-agent.ts). В будущем появится
 * `HttpAgentClient`, который будет обращаться к RetroCard Local Agent
 * (локальный HTTP/WS-сервер на компьютере пользователя), — при этом UI
 * менять не потребуется.
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

export interface LocalAgentClient {
  /** Текущее состояние соединения (без сетевых запросов). */
  getStatus(): AgentStatus;
  /** Подписка на изменения состояния соединения. Возвращает функцию отписки. */
  subscribe(listener: (status: AgentStatus) => void): () => void;

  connect(): Promise<AgentStatus>;
  disconnect(): Promise<AgentStatus>;

  /** Список поддерживаемых консолей. */
  listConsoles(): Promise<ConsoleProfile[]>;

  /** Полное сканирование карты с прогрессом. */
  scanCard(onProgress?: ProgressCallback): Promise<ScanResult>;

  /** Построить план организации файлов (без изменений на карте). */
  buildOrganizationPlan(scan: ScanResult): Promise<OrganizationPlan>;
  /** Применить план. Выполняется только после подтверждения пользователем. */
  applyOrganizationPlan(
    plan: OrganizationPlan,
    onProgress?: ProgressCallback,
  ): Promise<OperationResult>;

  /** Предпросмотр очистки коллекции по фильтрам. */
  previewCleanup(scan: ScanResult, filters: CleanerFilters): Promise<CleanerPreview>;
  /** Удалить выбранные пути (только явно подтверждённые пользователем). */
  deletePaths(paths: string[], onProgress?: ProgressCallback): Promise<OperationResult>;

  listBackups(): Promise<BackupEntry[]>;
  createBackup(
    includes: string[],
    onProgress?: ProgressCallback,
  ): Promise<BackupEntry>;

  /** Рекомендуемая структура папок для новой карты. */
  buildSetupPlan(input: {
    consoleId: ConsoleId;
    firmwareId: FirmwareId;
    cardSizeGb: number;
  }): Promise<SetupPlan>;

  /** Демонстрационный план миграции между прошивками. */
  buildMigrationPlan(from: FirmwareId, to: FirmwareId): Promise<MigrationPlan>;
}
