/**
 * RetroCard — доменные типы.
 *
 * Этот файл — контракт между UI и локальным помощником (Local Agent).
 * UI не знает, откуда приходят данные: из mock-слоя или из реального
 * RetroCard Local Agent (Windows). Любая реализация должна соответствовать
 * интерфейсу `LocalAgentClient` (см. ./client.ts).
 */

/** Идентификатор прошивки. Расширяется по мере поддержки новых ОС. */
export type FirmwareId =
  | "arkos"
  | "stock"
  | "jelos"
  | "rocknix"
  | "batocera"
  | "muos"
  | "unknown";

/** Идентификатор консоли. Сейчас поддержан RG353V, архитектура — на несколько. */
export type ConsoleId = "rg353v" | "rg35xx" | "rg405m" | "generic";

/** Идентификатор эмулируемой системы (папка ROM'ов). */
export type SystemId =
  | "nes"
  | "snes"
  | "gb"
  | "gbc"
  | "gba"
  | "megadrive"
  | "genesis"
  | "n64"
  | "psx"
  | "psp"
  | "arcade"
  | "mastersystem"
  | "pcengine"
  | "dos"
  | "unknown";

export type HealthStatus = "good" | "warning" | "critical";
export type Severity = "info" | "warning" | "critical";
export type ItemStatus = "ok" | "warning" | "error";

/** Профиль консоли: какие прошивки и системы поддерживаются. */
export interface ConsoleProfile {
  id: ConsoleId;
  name: string;
  vendor: string;
  firmwares: FirmwareId[];
  /** Рекомендуемая структура папок ROM'ов для этой консоли. */
  romsRoot: string;
  systems: SystemId[];
}

/** Метаданные системы: имя, папка, расширения, нужен ли BIOS. */
export interface SystemMeta {
  id: SystemId;
  /** Короткая метка для бейджа: NES, GBA, PSX… */
  short: string;
  name: string;
  /** Папка в структуре ROMs, зависит от прошивки в реальном агенте. */
  folder: string;
  extensions: string[];
  requiresBios: boolean;
  /** Токен акцента для UI (magenta | cyan | amber | coral | leaf). */
  accent: AccentToken;
}

export type AccentToken = "magenta" | "cyan" | "amber" | "coral" | "leaf";

export interface FirmwareInfo {
  id: FirmwareId;
  name: string;
  version: string | null;
  /** По каким признакам определена прошивка. */
  evidence: string[];
  confidence: number;
  /** true, если прошивка указана пользователем вручную. */
  manual?: boolean | undefined;
}

export interface SdCardInfo {
  id: string;
  label: string;
  mountPath: string;
  fileSystem: string;
  capacityBytes: number;
  usedBytes: number;
  freeBytes: number;
  consoleId: ConsoleId;
  firmware: FirmwareInfo;
  health: HealthStatus;
  readSpeedMbs: number;
  writeSpeedMbs: number;
}

export interface RomEntry {
  id: string;
  title: string;
  systemId: SystemId;
  fileName: string;
  /** Текущий путь на карте. */
  path: string;
  sizeBytes: number;
  format: string;
  region?: "USA" | "EUR" | "JPN" | "WORLD" | "UNK" | undefined;
  language?: string | undefined;
  hasArtwork: boolean;
  status: ItemStatus;
  problems: string[];
}

export interface BiosEntry {
  fileName: string;
  systemId: SystemId;
  status: "present" | "missing" | "unused";
  required: boolean;
  sizeBytes?: number | undefined;
  note: string;
}

export interface ProblemEntry {
  id: string;
  severity: Severity;
  category: "structure" | "bios" | "duplicates" | "artwork" | "unknown" | "saves";
  title: string;
  detail: string;
  affected: number;
}

/** Узел дерева файлов карты. */
export interface FolderNode {
  name: string;
  kind: "dir" | "file";
  sizeBytes?: number | undefined;
  fileCount?: number | undefined;
  systemId?: SystemId | undefined;
  status?: ItemStatus | undefined;
  children?: FolderNode[] | undefined;
}

export interface UnknownFile {
  path: string;
  sizeBytes: number;
  reason: string;
}

export interface SaveEntry {
  fileName: string;
  systemId: SystemId;
  sizeBytes: number;
  modifiedAt: string;
}

export interface ScanSummary {
  totalFiles: number;
  romCount: number;
  systemCount: number;
  biosFound: number;
  biosMissing: number;
  saveCount: number;
  artworkCount: number;
  unknownCount: number;
  problemCount: number;
  durationMs: number;
  scannedAt: string;
}

export type DuplicateKind = "exact" | "similar" | "version" | "region";

export interface DuplicateGroup {
  id: string;
  kind: DuplicateKind;
  title: string;
  systemId: SystemId;
  /** Байты, которые освободятся, если оставить одну копию. */
  reclaimableBytes: number;
  items: Array<{
    romId: string;
    fileName: string;
    path: string;
    sizeBytes: number;
    region?: RomEntry["region"] | undefined;
    label: string;
    recommendedKeep: boolean;
  }>;
}

export type MoveAction = "move" | "rename" | "create-folder" | "delete";

export interface OrganizationMove {
  id: string;
  action: MoveAction;
  fileName: string;
  from: string;
  to: string;
  systemId: SystemId;
  sizeBytes: number;
  /** Уверенность определения системы, 0..1 */
  confidence: number;
  reason: string;
}

export interface OrganizationPlan {
  id: string;
  createdAt: string;
  moves: OrganizationMove[];
  warnings: string[];
  foldersToCreate: string[];
  totalBytes: number;
}

export interface CleanerFilters {
  systems: SystemId[];
  regions: Array<NonNullable<RomEntry["region"]>>;
  languages: string[];
  removeDuplicates: boolean;
  removeUnknown: boolean;
  removeOrphanArtwork: boolean;
  removeAltVersions: boolean;
}

export interface CleanerPreview {
  before: { files: number; usedBytes: number };
  after: { files: number; usedBytes: number };
  freedBytes: number;
  items: Array<{ path: string; sizeBytes: number; reason: string }>;
}

export interface BackupEntry {
  id: string;
  label: string;
  createdAt: string;
  sizeBytes: number;
  fileCount: number;
  status: "complete" | "running" | "failed";
  includes: string[];
}

export interface FolderPlanNode {
  path: string;
  depth: number;
  note?: string | undefined;
}

export interface SetupPlan {
  consoleId: ConsoleId;
  firmwareId: FirmwareId;
  cardSizeGb: number;
  folders: FolderPlanNode[];
  notes: string[];
}

export interface MigrationPlan {
  from: FirmwareId;
  to: FirmwareId;
  steps: Array<{ title: string; detail: string; risk: Severity }>;
  folderChanges: Array<{ from: string; to: string; note: string }>;
  warnings: string[];
}

/** Полный результат сканирования карты. */
export interface ScanResult {
  card: SdCardInfo;
  summary: ScanSummary;
  roms: RomEntry[];
  bios: BiosEntry[];
  saves: SaveEntry[];
  problems: ProblemEntry[];
  tree: FolderNode;
  unknownFiles: UnknownFile[];
  duplicates: DuplicateGroup[];
  /** Папки, в которых искались ROM'ы (относительно корня карты). */
  romsRoots?: RomFolderInfo[] | undefined;
}

/** Папка с ROM'ами, найденная автоматически или указанная вручную. */
export interface RomFolderInfo {
  path: string;
  systemId?: SystemId | null | undefined;
  manual?: boolean | undefined;
}

/** Ручная настройка папки с ROM'ами. */
export interface RomFolderConfig {
  /** Путь относительно корня карты, например "roms" или "SDCARD/games". */
  path: string;
  /** Если задано — все файлы в папке считаются ROM'ами этой системы. */
  systemId?: SystemId | "auto" | undefined;
}

/** Ручные настройки чтения карты: прошивка, консоль и папки ROM'ов. */
export interface AgentConfig {
  /** "auto" — автоопределение прошивки. */
  firmwareId: FirmwareId | "auto";
  consoleId: ConsoleId;
  romsPaths: RomFolderConfig[];
}

/** Папка карты для выбора вручную. */
export interface BrowseEntry {
  name: string;
  path: string;
  fileCount: number;
}

export interface BrowseResult {
  root: string;
  path: string;
  parent: string | null;
  dirs: BrowseEntry[];
  fileCount: number;
}

export type AgentConnectionState = "disconnected" | "connecting" | "connected" | "error";

export interface AgentStatus {
  state: AgentConnectionState;
  /** Версия локального помощника, если подключен. */
  version: string | null;
  /** Транспорт: mock | http | websocket. */
  transport: "mock" | "http" | "ws";
  host: string;
  message?: string | undefined;
}

export interface ProgressEvent {
  phase: string;
  percent: number;
  message: string;
}

export type ProgressCallback = (event: ProgressEvent) => void;

export interface OperationResult {
  ok: boolean;
  applied: number;
  failed: number;
  log: string[];
}
