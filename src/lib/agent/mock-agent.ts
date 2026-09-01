/**
 * MockAgentClient — реализация LocalAgentClient на демонстрационных данных.
 *
 * Имитирует: подключение помощника, сканирование карты, определение прошивки,
 * поиск игр/BIOS/дубликатов, построение плана организации, выполнение операций
 * с прогрессом. Никаких обращений к файловой системе браузера.
 */
import { BIOS_REQUIREMENTS, CONSOLES, systemMeta } from "./catalog";
import {
  MOCK_BACKUPS,
  MOCK_BIOS,
  MOCK_CARD,
  MOCK_DUPLICATES,
  MOCK_PROBLEMS,
  MOCK_ROMS,
  MOCK_SAVES,
  MOCK_SUMMARY_BASE,
  MOCK_TREE,
  MOCK_UNKNOWN_FILES,
} from "./mock-data";
import type { LocalAgentClient } from "./client";
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
  OrganizationMove,
  OrganizationPlan,
  ProgressCallback,
  ScanResult,
  SetupPlan,
  SystemId,
} from "./types";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Определение системы по расширению и имени файла (упрощённая эвристика). */
function detectSystem(fileName: string, fallback: SystemId): SystemId {
  const lower = fileName.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf("."));
  const byExt: Array<[string, SystemId]> = [
    [".gba", "gba"],
    [".gbc", "gbc"],
    [".gb", "gb"],
    [".nes", "nes"],
    [".sfc", "snes"],
    [".smc", "snes"],
    [".z64", "n64"],
    [".n64", "n64"],
    [".v64", "n64"],
    [".md", "megadrive"],
    [".gen", "megadrive"],
    [".sms", "mastersystem"],
    [".pce", "pcengine"],
    [".iso", "psp"],
    [".cso", "psp"],
    [".chd", "psx"],
    [".cue", "psx"],
    [".bin", "psx"],
    [".img", "psx"],
    [".pbp", "psx"],
  ];
  const hit = byExt.find(([e]) => e === ext);
  if (hit) return hit[1];
  if (ext === ".zip") {
    if (/mario|contra|zelda|castlevania/.test(lower)) return "nes";
    if (/mslug|sf|kof|neogeo/.test(lower)) return "arcade";
  }
  return fallback;
}

export class MockAgentClient implements LocalAgentClient {
  private status: AgentStatus = {
    state: "disconnected",
    version: null,
    transport: "mock",
    host: "127.0.0.1:7345",
    message: "Локальный помощник не подключён (демо-режим)",
  };

  private listeners = new Set<(s: AgentStatus) => void>();
  private backups: BackupEntry[] = [...MOCK_BACKUPS];

  getStatus(): AgentStatus {
    return this.status;
  }

  subscribe(listener: (status: AgentStatus) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(next: Partial<AgentStatus>) {
    this.status = { ...this.status, ...next };
    this.listeners.forEach((l) => l(this.status));
  }

  async connect(): Promise<AgentStatus> {
    this.set({ state: "connecting", message: "Поиск локального помощника…" });
    await sleep(900);
    this.set({
      state: "connected",
      version: "0.1.0-mock",
      message: "Демо-помощник подключён. Реальный агент появится позже.",
    });
    return this.status;
  }

  async disconnect(): Promise<AgentStatus> {
    await sleep(250);
    this.set({ state: "disconnected", version: null, message: "Соединение закрыто" });
    return this.status;
  }

  async listConsoles(): Promise<ConsoleProfile[]> {
    return CONSOLES;
  }

  async scanCard(onProgress?: ProgressCallback): Promise<ScanResult> {
    const started = Date.now();
    const phases: Array<[string, string, number]> = [
      ["mount", "Чтение раздела exFAT…", 8],
      ["firmware", "Определение прошивки…", 22],
      ["tree", "Обход структуры папок…", 40],
      ["roms", "Индексация ROM-файлов…", 62],
      ["bios", "Проверка BIOS…", 74],
      ["artwork", "Сверка обложек и сохранений…", 86],
      ["duplicates", "Поиск дубликатов…", 96],
      ["done", "Сканирование завершено", 100],
    ];
    for (const [phase, message, percent] of phases) {
      onProgress?.({ phase, message, percent });
      await sleep(420);
    }

    const durationMs = Date.now() - started;
    return {
      card: MOCK_CARD,
      summary: {
        totalFiles: MOCK_SUMMARY_BASE.totalFiles,
        romCount: MOCK_ROMS.length,
        systemCount: new Set(MOCK_ROMS.map((r) => r.systemId).filter((s) => s !== "unknown")).size,
        biosFound: MOCK_BIOS.filter((b) => b.status === "present").length,
        biosMissing: MOCK_BIOS.filter((b) => b.status === "missing").length,
        saveCount: MOCK_SUMMARY_BASE.saveCount,
        artworkCount: MOCK_SUMMARY_BASE.artworkCount,
        unknownCount: MOCK_UNKNOWN_FILES.length,
        problemCount: MOCK_PROBLEMS.length,
        durationMs,
        scannedAt: new Date().toISOString(),
      },
      roms: MOCK_ROMS,
      bios: MOCK_BIOS,
      saves: MOCK_SAVES,
      problems: MOCK_PROBLEMS,
      tree: MOCK_TREE,
      unknownFiles: MOCK_UNKNOWN_FILES,
      duplicates: MOCK_DUPLICATES,
    };
  }

  async buildOrganizationPlan(scan: ScanResult): Promise<OrganizationPlan> {
    await sleep(700);
    const root = "/roms";
    const moves: OrganizationMove[] = [];
    const folders = new Set<string>();

    for (const rom of scan.roms) {
      const detected = detectSystem(rom.fileName, rom.systemId);
      const meta = systemMeta(detected);
      const target = `${root}/${meta.folder}`;
      const misplaced = rom.path !== target;
      if (!misplaced) continue;
      folders.add(target);
      moves.push({
        id: `mv-${rom.id}`,
        action: "move",
        fileName: rom.fileName,
        from: `${rom.path}/${rom.fileName}`,
        to: `${target}/${rom.fileName}`,
        systemId: detected,
        sizeBytes: rom.sizeBytes,
        confidence: detected === "unknown" ? 0.4 : rom.systemId === detected ? 0.99 : 0.86,
        reason:
          rom.systemId === "unknown"
            ? `Система определена по расширению ${rom.format}`
            : `Файл должен лежать в ${meta.folder}/`,
      });
    }

    // Слияние genesis → megadrive: типовая проблема сборок ArkOS.
    for (const rom of scan.roms.filter((r) => r.systemId === "genesis")) {
      moves.push({
        id: `mv-merge-${rom.id}`,
        action: "move",
        fileName: rom.fileName,
        from: `/roms/genesis/${rom.fileName}`,
        to: `/roms/megadrive/${rom.fileName}`,
        systemId: "megadrive",
        sizeBytes: rom.sizeBytes,
        confidence: 0.8,
        reason: "Объединение genesis и megadrive в одну папку",
      });
    }

    for (const file of scan.unknownFiles) {
      moves.push({
        id: `mv-unknown-${file.path}`,
        action: "move",
        fileName: file.path.split("/").pop() ?? file.path,
        from: file.path,
        to: `/roms/unsorted${file.path.slice(file.path.lastIndexOf("/"))}`,
        systemId: "unknown",
        sizeBytes: file.sizeBytes,
        confidence: 0.3,
        reason: file.reason,
      });
    }

    return {
      id: `plan-${Date.now()}`,
      createdAt: new Date().toISOString(),
      moves,
      foldersToCreate: [...folders],
      totalBytes: moves.reduce((s, m) => s + m.sizeBytes, 0),
      warnings: [
        "Перемещение больших образов PSX/PSP может занять несколько минут.",
        "Файлы сохранений не перемещаются — они остаются в /saves.",
        "Рекомендуется создать резервную копию перед применением плана.",
      ],
    };
  }

  async applyOrganizationPlan(
    plan: OrganizationPlan,
    onProgress?: ProgressCallback,
  ): Promise<OperationResult> {
    const log: string[] = [];
    const total = plan.moves.length || 1;
    for (let i = 0; i < plan.moves.length; i++) {
      const move = plan.moves[i];
      log.push(`${move.action.toUpperCase()} ${move.from} → ${move.to}`);
      onProgress?.({
        phase: "apply",
        percent: Math.round(((i + 1) / total) * 100),
        message: `${move.fileName} → ${move.to}`,
      });
      await sleep(90);
    }
    onProgress?.({ phase: "done", percent: 100, message: "Готово" });
    return { ok: true, applied: plan.moves.length, failed: 0, log };
  }

  async previewCleanup(scan: ScanResult, filters: CleanerFilters): Promise<CleanerPreview> {
    await sleep(400);
    const items: CleanerPreview["items"] = [];

    if (filters.removeUnknown) {
      scan.unknownFiles.forEach((f) =>
        items.push({ path: f.path, sizeBytes: f.sizeBytes, reason: f.reason }),
      );
    }
    if (filters.removeDuplicates) {
      scan.duplicates
        .filter((g) => g.kind === "exact" || g.kind === "similar")
        .forEach((g) =>
          g.items
            .filter((i) => !i.recommendedKeep)
            .forEach((i) =>
              items.push({ path: `${i.path}/${i.fileName}`, sizeBytes: i.sizeBytes, reason: `Дубликат: ${g.title}` }),
            ),
        );
    }
    if (filters.removeAltVersions) {
      scan.duplicates
        .filter((g) => g.kind === "version")
        .forEach((g) =>
          g.items
            .filter((i) => !i.recommendedKeep)
            .forEach((i) =>
              items.push({ path: `${i.path}/${i.fileName}`, sizeBytes: i.sizeBytes, reason: `Альтернативная версия: ${g.title}` }),
            ),
        );
    }
    if (filters.systems.length > 0) {
      scan.roms
        .filter((r) => filters.systems.includes(r.systemId))
        .forEach((r) =>
          items.push({ path: `${r.path}/${r.fileName}`, sizeBytes: r.sizeBytes, reason: `Система исключена: ${systemMeta(r.systemId).short}` }),
        );
    }
    if (filters.regions.length > 0) {
      scan.roms
        .filter((r) => r.region && filters.regions.includes(r.region))
        .forEach((r) =>
          items.push({ path: `${r.path}/${r.fileName}`, sizeBytes: r.sizeBytes, reason: `Регион исключён: ${r.region}` }),
        );
    }
    if (filters.languages.length > 0) {
      scan.roms
        .filter((r) => r.language && filters.languages.some((l) => r.language?.includes(l)))
        .forEach((r) =>
          items.push({ path: `${r.path}/${r.fileName}`, sizeBytes: r.sizeBytes, reason: `Язык исключён: ${r.language}` }),
        );
    }
    if (filters.removeOrphanArtwork) {
      items.push({ path: "/roms/nes/images/orphans (26 файлов)", sizeBytes: 74 * 1024 * 1024, reason: "Обложки без ROM" });
    }

    const unique = new Map(items.map((i) => [i.path, i]));
    const list = [...unique.values()];
    const freedBytes = list.reduce((s, i) => s + i.sizeBytes, 0);

    return {
      before: { files: scan.summary.totalFiles, usedBytes: scan.card.usedBytes },
      after: {
        files: scan.summary.totalFiles - list.length,
        usedBytes: Math.max(0, scan.card.usedBytes - freedBytes),
      },
      freedBytes,
      items: list,
    };
  }

  async deletePaths(paths: string[], onProgress?: ProgressCallback): Promise<OperationResult> {
    const log: string[] = [];
    for (let i = 0; i < paths.length; i++) {
      log.push(`DELETE ${paths[i]}`);
      onProgress?.({
        phase: "delete",
        percent: Math.round(((i + 1) / Math.max(paths.length, 1)) * 100),
        message: paths[i],
      });
      await sleep(120);
    }
    return { ok: true, applied: paths.length, failed: 0, log };
  }

  async listBackups(): Promise<BackupEntry[]> {
    await sleep(200);
    return this.backups;
  }

  async createBackup(includes: string[], onProgress?: ProgressCallback): Promise<BackupEntry> {
    const steps = ["Подготовка списка файлов…", "Копирование сохранений…", "Копирование BIOS…", "Упаковка архива…", "Проверка контрольных сумм…"];
    for (let i = 0; i < steps.length; i++) {
      onProgress?.({ phase: "backup", percent: Math.round(((i + 1) / steps.length) * 100), message: steps[i] });
      await sleep(520);
    }
    const entry: BackupEntry = {
      id: `bk-${Date.now()}`,
      label: `Резервная копия (${includes.join(", ") || "выборочно"})`,
      createdAt: new Date().toISOString(),
      sizeBytes: 320 * 1024 * 1024 + includes.length * 180 * 1024 * 1024,
      fileCount: 48 + includes.length * 37,
      status: "complete",
      includes,
    };
    this.backups = [entry, ...this.backups];
    return entry;
  }

  async buildSetupPlan(input: {
    consoleId: ConsoleId;
    firmwareId: FirmwareId;
    cardSizeGb: number;
  }): Promise<SetupPlan> {
    await sleep(500);
    const profile = CONSOLES.find((c) => c.id === input.consoleId) ?? CONSOLES[0];
    const romsRoot = input.firmwareId === "stock" ? "/Roms" : profile.romsRoot;
    const folders = [
      { path: romsRoot, depth: 0, note: "Корень библиотеки игр" },
      ...profile.systems.map((s) => ({
        path: `${romsRoot}/${systemMeta(s).folder}`,
        depth: 1,
        note: systemMeta(s).name,
      })),
      { path: `${romsRoot}/unsorted`, depth: 1, note: "Файлы для ручной сортировки" },
      { path: "/bios", depth: 0, note: "BIOS-файлы (добавляются пользователем)" },
      { path: "/saves", depth: 0, note: "Сохранения и сейв-стейты" },
      { path: "/artwork", depth: 0, note: "Обложки и скриншоты" },
      { path: "/backup", depth: 0, note: "Локальные резервные копии" },
    ];
    return {
      consoleId: input.consoleId,
      firmwareId: input.firmwareId,
      cardSizeGb: input.cardSizeGb,
      folders,
      notes: [
        `Файловая система: exFAT для карт > 32 ГБ (${input.cardSizeGb} ГБ).`,
        "Размер кластера 32 КБ — компромисс между скоростью и потерями места.",
        "RetroCard не поставляет BIOS и образы игр: добавьте свои файлы вручную.",
        input.firmwareId === "stock"
          ? "Stock OS чувствителен к регистру имён папок — не переименовывайте их."
          : `${input.firmwareId.toUpperCase()} читает список систем из es_systems.cfg.`,
      ],
    };
  }

  async buildMigrationPlan(from: FirmwareId, to: FirmwareId): Promise<MigrationPlan> {
    await sleep(600);
    return {
      from,
      to,
      steps: [
        { title: "Резервная копия", detail: "Скопировать /saves, /bios и конфигурации перед миграцией.", risk: "critical" },
        { title: "Экспорт списка систем", detail: "Сохранить текущее сопоставление папок и систем.", risk: "info" },
        { title: "Перенос ROM-папок", detail: `Привести структуру ${from.toUpperCase()} к схеме ${to.toUpperCase()}.`, risk: "warning" },
        { title: "Перенос сохранений", detail: "Форматы .srm/.state совместимы, пути отличаются.", risk: "warning" },
        { title: "Проверка BIOS", detail: "Целевая сборка ищет BIOS в другой папке.", risk: "warning" },
        { title: "Первый запуск", detail: "Обновить скрапер и проверить запуск по одной игре на систему.", risk: "info" },
      ],
      folderChanges: [
        { from: "/roms/megadrive", to: "/roms/genesis", note: `${to.toUpperCase()} использует другое имя папки` },
        { from: "/roms/psx", to: "/roms/psx", note: "Без изменений" },
        { from: "/bios", to: "/roms/bios", note: "BIOS переезжает внутрь библиотеки" },
        { from: "/saves", to: "/roms/savestates", note: "Сейв-стейты хранятся рядом с ROM'ами" },
      ],
      warnings: [
        "Демонстрационный режим: изменения не применяются к карте.",
        "Сейв-стейты эмуляторов между сборками часто несовместимы — берегите .srm.",
        "Проверьте, что целевая сборка поддерживает вашу ревизию консоли.",
      ],
    };
  }
}

export const BIOS_CATALOG = BIOS_REQUIREMENTS;
