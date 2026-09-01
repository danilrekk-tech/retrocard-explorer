/**
 * Mock-слой: реалистичная демонстрационная microSD-карта.
 * Только данные, никакой логики UI. Легко заменяется реальным агентом.
 */
import { BIOS_REQUIREMENTS, systemMeta } from "./catalog";
import type {
  BackupEntry,
  BiosEntry,
  DuplicateGroup,
  FolderNode,
  ProblemEntry,
  RomEntry,
  SaveEntry,
  SdCardInfo,
  SystemId,
  UnknownFile,
} from "./types";

const MB = 1024 * 1024;
const GB = 1024 * MB;

type RomSeed = [
  title: string,
  systemId: SystemId,
  fileName: string,
  path: string,
  sizeMb: number,
  region: RomEntry["region"],
  hasArtwork: boolean,
  problems?: string[],
];

const ROM_SEEDS: RomSeed[] = [
  ["Super Mario Bros. 3", "nes", "Super Mario Bros 3.nes", "/roms/nes", 0.38, "USA", true],
  ["The Legend of Zelda", "nes", "Legend of Zelda.nes", "/roms/nes", 0.12, "USA", true],
  ["Contra", "nes", "Contra.zip", "/roms/nes", 0.11, "JPN", false, ["Нет обложки"]],
  ["Mario.zip", "unknown", "Mario.zip", "/roms", 0.04, "UNK", false, ["Файл в корне карты", "Система не определена по папке"]],
  ["Chrono Trigger", "snes", "Chrono Trigger.sfc", "/roms/snes", 4.0, "USA", true],
  ["Super Metroid", "snes", "Super Metroid.sfc", "/roms/snes", 3.0, "USA", true],
  ["Donkey Kong Country 2", "snes", "DKC2.smc", "/roms/snes", 4.0, "EUR", true],
  ["Secret of Mana", "snes", "Seiken Densetsu 2.sfc", "/roms/snes", 2.0, "JPN", false, ["Нет обложки"]],
  ["Tetris", "gb", "Tetris.gb", "/roms/gb", 0.03, "WORLD", true],
  ["Pokémon Red", "gb", "Pokemon Red.gb", "/roms/gb", 1.0, "USA", true],
  ["Pokémon Crystal", "gbc", "Pokemon Crystal.gbc", "/roms/gbc", 2.0, "USA", true],
  ["Wario Land 3", "gbc", "Wario Land 3.gbc", "/roms/gbc", 2.0, "EUR", false, ["Нет обложки"]],
  ["Pokémon Emerald", "gba", "Pokemon.gba", "/roms", 16.0, "USA", true, ["Файл лежит вне папки GBA"]],
  ["Metroid: Zero Mission", "gba", "Metroid Zero Mission.gba", "/roms/gba", 8.0, "USA", true],
  ["Advance Wars 2", "gba", "Advance Wars 2.gba", "/roms/gba", 8.0, "USA", true],
  ["Golden Sun", "gba", "Golden Sun.gba", "/roms/gba", 8.0, "EUR", false, ["Нет обложки"]],
  ["Sonic the Hedgehog 2", "megadrive", "Sonic 2.md", "/roms/megadrive", 1.0, "EUR", true],
  ["Streets of Rage 2", "megadrive", "Streets of Rage 2.bin", "/roms/megadrive", 2.0, "USA", true],
  ["Gunstar Heroes", "genesis", "Gunstar Heroes.gen", "/roms/genesis", 2.0, "USA", true, ["Дублирует папку megadrive"]],
  ["Super Mario 64", "n64", "Super Mario 64.z64", "/roms/n64", 8.0, "USA", true],
  ["GoldenEye 007", "n64", "GoldenEye 007.z64", "/roms/n64", 12.0, "EUR", true],
  ["Mario Kart 64", "n64", "Mario Kart 64.n64", "/roms/n64", 12.0, "USA", false, ["Формат .n64 менее совместим"]],
  ["Final Fantasy VII", "psx", "Final Fantasy VII.chd", "/roms/psx", 680, "USA", true],
  ["Tekken 3", "psx", "Tekken.bin", "/roms", 642, "JPN", false, ["Файл в корне /roms", "Нет .cue рядом с .bin"]],
  ["Metal Gear Solid", "psx", "Metal Gear Solid.chd", "/roms/psx", 620, "EUR", true],
  ["Crash Bandicoot 2", "psx", "Crash Bandicoot 2.chd", "/roms/psx", 410, "USA", true],
  ["God of War: Chains of Olympus", "psp", "GoW Chains of Olympus.iso", "/roms/psp", 1180, "USA", true],
  ["Daxter", "psp", "Daxter.cso", "/roms/psp", 780, "EUR", true],
  ["Metal Slug X", "arcade", "mslugx.zip", "/roms/arcade", 26, "WORLD", true],
  ["Street Fighter Alpha 3", "arcade", "sfa3.zip", "/roms/arcade", 44, "WORLD", false, ["Требуется BIOS neogeo.zip для части наборов"]],
  ["Alex Kidd in Miracle World", "mastersystem", "Alex Kidd.sms", "/roms/mastersystem", 0.25, "EUR", true],
  ["Bonk's Adventure", "pcengine", "Bonk's Adventure.pce", "/roms/pcengine", 0.5, "USA", false, ["Нет обложки"]],
  ["Super Mario Bros. 3 (Rev A)", "nes", "Super Mario Bros 3 (Rev A).nes", "/roms/nes", 0.38, "EUR", false, ["Похоже на дубликат"]],
  ["Chrono Trigger (JP)", "snes", "Chrono Trigger (J).sfc", "/roms/snes", 4.0, "JPN", false, ["Другой регион той же игры"]],
  ["Tekken 3 (copy)", "psx", "Tekken 3 (1).chd", "/roms/psx", 642, "JPN", false, ["Точный дубликат"]],
  ["Pokémon Emerald (hack)", "gba", "Pokemon Emerald v1.1.gba", "/roms/gba", 16.0, "USA", false, ["Другая версия игры"]],
];

function romStatus(problems: string[]): RomEntry["status"] {
  if (problems.some((p) => p.includes("корне") || p.includes("не определена") || p.includes("дубликат"))) return "error";
  return problems.length > 0 ? "warning" : "ok";
}

export const MOCK_ROMS: RomEntry[] = ROM_SEEDS.map(
  ([title, systemId, fileName, path, sizeMb, region, hasArtwork, problems = []], i) => ({
    id: `rom-${i + 1}`,
    title,
    systemId,
    fileName,
    path,
    sizeBytes: Math.round(sizeMb * MB),
    format: fileName.slice(fileName.lastIndexOf(".")).toLowerCase(),
    region,
    language: region === "JPN" ? "ja" : region === "EUR" ? "en/de/fr" : "en",
    hasArtwork,
    status: romStatus(problems),
    problems,
  }),
);

const PRESENT_BIOS = new Set([
  "scph5501.bin",
  "scph1001.bin",
  "gba_bios.bin",
  "syscard3.pce",
]);

export const MOCK_BIOS: BiosEntry[] = [
  ...BIOS_REQUIREMENTS.map<BiosEntry>((req) => ({
    fileName: req.fileName,
    systemId: req.systemId,
    required: req.required,
    status: PRESENT_BIOS.has(req.fileName) ? "present" : "missing",
    sizeBytes: PRESENT_BIOS.has(req.fileName) ? 512 * 1024 : undefined,
    note: req.note,
  })),
  {
    fileName: "saturn_bios.bin",
    systemId: "unknown",
    required: false,
    status: "unused",
    sizeBytes: 512 * 1024,
    note: "Sega Saturn не поддерживается этой консолью — файл не используется",
  },
  {
    fileName: "bios7.bin",
    systemId: "unknown",
    required: false,
    status: "unused",
    sizeBytes: 16 * 1024,
    note: "BIOS Nintendo DS — не используется на RG353V",
  },
];

export const MOCK_SAVES: SaveEntry[] = [
  { fileName: "Pokemon Emerald.srm", systemId: "gba", sizeBytes: 128 * 1024, modifiedAt: "2026-08-24T19:12:00Z" },
  { fileName: "Chrono Trigger.srm", systemId: "snes", sizeBytes: 32 * 1024, modifiedAt: "2026-08-20T08:41:00Z" },
  { fileName: "Final Fantasy VII.mcr", systemId: "psx", sizeBytes: 128 * 1024, modifiedAt: "2026-08-29T21:03:00Z" },
  { fileName: "Super Mario 64.eep", systemId: "n64", sizeBytes: 2 * 1024, modifiedAt: "2026-07-11T11:22:00Z" },
  { fileName: "Metroid Zero Mission.sav", systemId: "gba", sizeBytes: 64 * 1024, modifiedAt: "2026-08-30T07:55:00Z" },
  { fileName: "Daxter.state", systemId: "psp", sizeBytes: 4 * MB, modifiedAt: "2026-08-31T18:30:00Z" },
];

export const MOCK_UNKNOWN_FILES: UnknownFile[] = [
  { path: "/roms/New Text Document.txt", sizeBytes: 1024, reason: "Не ROM и не системный файл" },
  { path: "/roms/gba/Thumbs.db", sizeBytes: 42 * 1024, reason: "Служебный файл Windows" },
  { path: "/roms/psx/._Tekken.bin", sizeBytes: 4 * 1024, reason: "Мусор macOS (AppleDouble)" },
  { path: "/roms/downloads/archive.part", sizeBytes: 320 * MB, reason: "Незавершённая загрузка" },
  { path: "/roms/unsorted/rom_pack_2019.rar", sizeBytes: 1.2 * GB, reason: "Архив RAR не читается эмуляторами" },
];

export const MOCK_PROBLEMS: ProblemEntry[] = [
  { id: "pb-1", severity: "critical", category: "bios", title: "Отсутствует BIOS для PlayStation", detail: "Не найден scph5502.bin для PAL-игр. Часть дисков не запустится.", affected: 1 },
  { id: "pb-2", severity: "critical", category: "structure", title: "ROM-файлы в корне /roms", detail: "Pokemon.gba и Tekken.bin лежат вне системных папок — консоль их не увидит.", affected: 2 },
  { id: "pb-3", severity: "critical", category: "duplicates", title: "Точные дубликаты", detail: "Найдены идентичные файлы на 642 МБ.", affected: 2 },
  { id: "pb-4", severity: "warning", category: "structure", title: "Дублирующиеся папки систем", detail: "Существуют и megadrive, и genesis — коллекция разъезжается.", affected: 2 },
  { id: "pb-5", severity: "warning", category: "artwork", title: "Игры без обложек", detail: "У 13 игр нет artwork в /roms/*/images.", affected: 13 },
  { id: "pb-6", severity: "warning", category: "unknown", title: "Неизвестные файлы", detail: "5 файлов не относятся к ROM, BIOS, сохранениям или обложкам.", affected: 5 },
  { id: "pb-7", severity: "info", category: "saves", title: "Сохранения вне папки saves", detail: "2 файла сохранений лежат рядом с ROM'ами.", affected: 2 },
];

export const MOCK_DUPLICATES: DuplicateGroup[] = [
  {
    id: "dup-1",
    kind: "exact",
    title: "Tekken 3",
    systemId: "psx",
    reclaimableBytes: 642 * MB,
    items: [
      { romId: "rom-24", fileName: "Tekken.bin", path: "/roms", sizeBytes: 642 * MB, region: "JPN", label: "в корне, без .cue", recommendedKeep: false },
      { romId: "rom-35", fileName: "Tekken 3 (1).chd", path: "/roms/psx", sizeBytes: 642 * MB, region: "JPN", label: "CHD, сжатый образ", recommendedKeep: true },
    ],
  },
  {
    id: "dup-2",
    kind: "similar",
    title: "Super Mario Bros. 3",
    systemId: "nes",
    reclaimableBytes: Math.round(0.38 * MB),
    items: [
      { romId: "rom-1", fileName: "Super Mario Bros 3.nes", path: "/roms/nes", sizeBytes: Math.round(0.38 * MB), region: "USA", label: "основной", recommendedKeep: true },
      { romId: "rom-33", fileName: "Super Mario Bros 3 (Rev A).nes", path: "/roms/nes", sizeBytes: Math.round(0.38 * MB), region: "EUR", label: "ревизия A", recommendedKeep: false },
    ],
  },
  {
    id: "dup-3",
    kind: "region",
    title: "Chrono Trigger",
    systemId: "snes",
    reclaimableBytes: 4 * MB,
    items: [
      { romId: "rom-5", fileName: "Chrono Trigger.sfc", path: "/roms/snes", sizeBytes: 4 * MB, region: "USA", label: "USA", recommendedKeep: true },
      { romId: "rom-34", fileName: "Chrono Trigger (J).sfc", path: "/roms/snes", sizeBytes: 4 * MB, region: "JPN", label: "Japan", recommendedKeep: false },
    ],
  },
  {
    id: "dup-4",
    kind: "version",
    title: "Pokémon Emerald",
    systemId: "gba",
    reclaimableBytes: 16 * MB,
    items: [
      { romId: "rom-13", fileName: "Pokemon.gba", path: "/roms", sizeBytes: 16 * MB, region: "USA", label: "оригинал", recommendedKeep: true },
      { romId: "rom-36", fileName: "Pokemon Emerald v1.1.gba", path: "/roms/gba", sizeBytes: 16 * MB, region: "USA", label: "версия 1.1 / hack", recommendedKeep: false },
    ],
  },
];

export const MOCK_BACKUPS: BackupEntry[] = [
  {
    id: "bk-3",
    label: "Перед организацией коллекции",
    createdAt: "2026-08-30T20:14:00Z",
    sizeBytes: 1.8 * GB,
    fileCount: 428,
    status: "complete",
    includes: ["saves", "bios", "configs"],
  },
  {
    id: "bk-2",
    label: "Полный бэкап сохранений",
    createdAt: "2026-08-18T09:02:00Z",
    sizeBytes: 240 * MB,
    fileCount: 61,
    status: "complete",
    includes: ["saves"],
  },
  {
    id: "bk-1",
    label: "BIOS и конфигурации",
    createdAt: "2026-07-29T15:40:00Z",
    sizeBytes: 96 * MB,
    fileCount: 24,
    status: "failed",
    includes: ["bios", "configs"],
  },
];

const totalRomBytes = MOCK_ROMS.reduce((sum, r) => sum + r.sizeBytes, 0);

export const MOCK_CARD: SdCardInfo = {
  id: "sd-mock-1",
  label: "RG353V-ROMS",
  mountPath: "E:\\",
  fileSystem: "exFAT",
  capacityBytes: 128 * GB,
  usedBytes: Math.round(78 * GB),
  freeBytes: 128 * GB - Math.round(78 * GB),
  consoleId: "rg353v",
  firmware: {
    id: "arkos",
    name: "ArkOS",
    version: "24.10",
    evidence: ["/roms/.emulationstation/es_systems.cfg", "/opt/system/Advanced/ArkOS", "META файл сборки"],
    confidence: 0.94,
  },
  health: "warning",
  readSpeedMbs: 92,
  writeSpeedMbs: 48,
};

export const MOCK_TREE: FolderNode = {
  name: "E:\\",
  kind: "dir",
  children: [
    {
      name: "roms",
      kind: "dir",
      fileCount: 402,
      children: [
        { name: "nes", kind: "dir", systemId: "nes", fileCount: 42, sizeBytes: 18 * MB, status: "ok" },
        { name: "snes", kind: "dir", systemId: "snes", fileCount: 68, sizeBytes: 210 * MB, status: "ok" },
        { name: "gb", kind: "dir", systemId: "gb", fileCount: 31, sizeBytes: 22 * MB, status: "ok" },
        { name: "gbc", kind: "dir", systemId: "gbc", fileCount: 26, sizeBytes: 41 * MB, status: "ok" },
        { name: "gba", kind: "dir", systemId: "gba", fileCount: 54, sizeBytes: 1.1 * GB, status: "warning" },
        { name: "megadrive", kind: "dir", systemId: "megadrive", fileCount: 38, sizeBytes: 96 * MB, status: "ok" },
        { name: "genesis", kind: "dir", systemId: "genesis", fileCount: 4, sizeBytes: 8 * MB, status: "warning" },
        { name: "n64", kind: "dir", systemId: "n64", fileCount: 22, sizeBytes: 620 * MB, status: "ok" },
        { name: "psx", kind: "dir", systemId: "psx", fileCount: 34, sizeBytes: 44 * GB, status: "warning" },
        { name: "psp", kind: "dir", systemId: "psp", fileCount: 12, sizeBytes: 26 * GB, status: "ok" },
        { name: "arcade", kind: "dir", systemId: "arcade", fileCount: 46, sizeBytes: 1.9 * GB, status: "ok" },
        { name: "mastersystem", kind: "dir", systemId: "mastersystem", fileCount: 11, sizeBytes: 4 * MB, status: "ok" },
        { name: "pcengine", kind: "dir", systemId: "pcengine", fileCount: 9, sizeBytes: 12 * MB, status: "ok" },
        { name: "unsorted", kind: "dir", fileCount: 6, sizeBytes: 1.4 * GB, status: "error" },
        { name: "downloads", kind: "dir", fileCount: 2, sizeBytes: 320 * MB, status: "error" },
        { name: "Pokemon.gba", kind: "file", sizeBytes: 16 * MB, status: "error" },
        { name: "Tekken.bin", kind: "file", sizeBytes: 642 * MB, status: "error" },
        { name: "Mario.zip", kind: "file", sizeBytes: 40 * 1024, status: "error" },
        { name: "New Text Document.txt", kind: "file", sizeBytes: 1024, status: "warning" },
      ],
    },
    {
      name: "bios",
      kind: "dir",
      fileCount: 6,
      children: [
        { name: "scph5501.bin", kind: "file", sizeBytes: 512 * 1024, status: "ok" },
        { name: "scph1001.bin", kind: "file", sizeBytes: 512 * 1024, status: "ok" },
        { name: "gba_bios.bin", kind: "file", sizeBytes: 16 * 1024, status: "ok" },
        { name: "syscard3.pce", kind: "file", sizeBytes: 256 * 1024, status: "ok" },
        { name: "saturn_bios.bin", kind: "file", sizeBytes: 512 * 1024, status: "warning" },
        { name: "bios7.bin", kind: "file", sizeBytes: 16 * 1024, status: "warning" },
      ],
    },
    {
      name: "saves",
      kind: "dir",
      fileCount: 61,
      children: [
        { name: "gba", kind: "dir", fileCount: 18, sizeBytes: 6 * MB, status: "ok" },
        { name: "snes", kind: "dir", fileCount: 14, sizeBytes: 2 * MB, status: "ok" },
        { name: "psx", kind: "dir", fileCount: 21, sizeBytes: 12 * MB, status: "ok" },
        { name: "states", kind: "dir", fileCount: 8, sizeBytes: 210 * MB, status: "ok" },
      ],
    },
    { name: "opt", kind: "dir", fileCount: 1240, sizeBytes: 2.4 * GB, status: "ok" },
    { name: ".emulationstation", kind: "dir", fileCount: 88, sizeBytes: 180 * MB, status: "ok" },
    { name: "System Volume Information", kind: "dir", fileCount: 4, sizeBytes: 12 * MB, status: "ok" },
  ],
};

export const MOCK_SUMMARY_BASE = {
  totalFiles: 1806,
  romCount: MOCK_ROMS.length,
  artworkCount: 318,
  saveCount: MOCK_SAVES.length + 55,
  totalRomBytes,
};
