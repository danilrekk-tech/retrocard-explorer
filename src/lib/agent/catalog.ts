/**
 * Справочники: консоли, системы, прошивки, требования к BIOS.
 * Расширяется при добавлении новых приставок — UI берёт данные только отсюда.
 */
import type { ConsoleProfile, FirmwareId, SystemId, SystemMeta } from "./types";

export const SYSTEMS: Record<SystemId, SystemMeta> = {
  nes: { id: "nes", short: "NES", name: "Nintendo Entertainment System", folder: "nes", extensions: [".nes", ".zip", ".unf"], requiresBios: false, accent: "amber" },
  snes: { id: "snes", short: "SNES", name: "Super Nintendo", folder: "snes", extensions: [".sfc", ".smc", ".zip"], requiresBios: false, accent: "cyan" },
  gb: { id: "gb", short: "GB", name: "Game Boy", folder: "gb", extensions: [".gb", ".zip"], requiresBios: false, accent: "leaf" },
  gbc: { id: "gbc", short: "GBC", name: "Game Boy Color", folder: "gbc", extensions: [".gbc", ".zip"], requiresBios: false, accent: "coral" },
  gba: { id: "gba", short: "GBA", name: "Game Boy Advance", folder: "gba", extensions: [".gba", ".zip"], requiresBios: true, accent: "magenta" },
  megadrive: { id: "megadrive", short: "MD", name: "Sega Mega Drive", folder: "megadrive", extensions: [".md", ".bin", ".gen", ".zip"], requiresBios: false, accent: "cyan" },
  genesis: { id: "genesis", short: "GEN", name: "Sega Genesis", folder: "genesis", extensions: [".gen", ".bin", ".zip"], requiresBios: false, accent: "amber" },
  n64: { id: "n64", short: "N64", name: "Nintendo 64", folder: "n64", extensions: [".n64", ".z64", ".v64", ".zip"], requiresBios: false, accent: "leaf" },
  psx: { id: "psx", short: "PSX", name: "Sony PlayStation", folder: "psx", extensions: [".bin", ".cue", ".chd", ".pbp", ".img"], requiresBios: true, accent: "coral" },
  psp: { id: "psp", short: "PSP", name: "Sony PSP", folder: "psp", extensions: [".iso", ".cso"], requiresBios: false, accent: "magenta" },
  arcade: { id: "arcade", short: "ARC", name: "Arcade (FBNeo / MAME)", folder: "arcade", extensions: [".zip", ".7z"], requiresBios: true, accent: "amber" },
  mastersystem: { id: "mastersystem", short: "SMS", name: "Sega Master System", folder: "mastersystem", extensions: [".sms", ".zip"], requiresBios: false, accent: "cyan" },
  pcengine: { id: "pcengine", short: "PCE", name: "PC Engine", folder: "pcengine", extensions: [".pce", ".zip"], requiresBios: false, accent: "leaf" },
  dos: { id: "dos", short: "DOS", name: "MS-DOS", folder: "pc", extensions: [".zip", ".exe"], requiresBios: false, accent: "coral" },
  unknown: { id: "unknown", short: "?", name: "Неизвестная система", folder: "unsorted", extensions: [], requiresBios: false, accent: "magenta" },
};

export const FIRMWARE_LABELS: Record<FirmwareId, string> = {
  arkos: "ArkOS",
  stock: "Stock OS",
  jelos: "JELOS",
  rocknix: "ROCKNIX",
  unknown: "Unknown",
};

export const CONSOLES: ConsoleProfile[] = [
  {
    id: "rg353v",
    name: "RG353V",
    vendor: "Anbernic",
    firmwares: ["arkos", "stock", "jelos", "rocknix"],
    romsRoot: "/roms",
    systems: ["nes", "snes", "gb", "gbc", "gba", "megadrive", "genesis", "n64", "psx", "psp", "arcade", "mastersystem", "pcengine"],
  },
  {
    id: "rg35xx",
    name: "RG35XX H",
    vendor: "Anbernic",
    firmwares: ["stock", "rocknix", "unknown"],
    romsRoot: "/Roms",
    systems: ["nes", "snes", "gb", "gbc", "gba", "megadrive", "n64", "psx", "arcade"],
  },
  {
    id: "rg405m",
    name: "RG405M",
    vendor: "Anbernic",
    firmwares: ["stock", "rocknix"],
    romsRoot: "/roms",
    systems: ["nes", "snes", "gba", "n64", "psx", "psp", "arcade", "dos"],
  },
  {
    id: "generic",
    name: "Универсальная сборка",
    vendor: "Другое",
    firmwares: ["arkos", "jelos", "rocknix", "unknown"],
    romsRoot: "/roms",
    systems: ["nes", "snes", "gb", "gbc", "gba", "megadrive", "n64", "psx", "psp", "arcade"],
  },
];

/** Какие BIOS-файлы ожидаются для систем. Ссылки/загрузка не предусмотрены. */
export const BIOS_REQUIREMENTS: Array<{
  fileName: string;
  systemId: SystemId;
  required: boolean;
  note: string;
}> = [
  { fileName: "scph5501.bin", systemId: "psx", required: true, note: "PlayStation (NTSC-U) — обязателен" },
  { fileName: "scph1001.bin", systemId: "psx", required: true, note: "PlayStation (NTSC-U) альтернативный" },
  { fileName: "scph5502.bin", systemId: "psx", required: false, note: "PlayStation (PAL)" },
  { fileName: "gba_bios.bin", systemId: "gba", required: false, note: "GBA — повышает точность эмуляции" },
  { fileName: "neogeo.zip", systemId: "arcade", required: true, note: "Neo Geo BIOS для FBNeo" },
  { fileName: "pgm.zip", systemId: "arcade", required: false, note: "PGM BIOS, нужен отдельным играм" },
  { fileName: "bios_CD_U.bin", systemId: "megadrive", required: false, note: "Sega CD (NTSC-U)" },
  { fileName: "syscard3.pce", systemId: "pcengine", required: false, note: "PC Engine CD" },
];

export function systemMeta(id: SystemId): SystemMeta {
  return SYSTEMS[id] ?? SYSTEMS.unknown;
}

export function consoleProfile(id: string): ConsoleProfile {
  return CONSOLES.find((c) => c.id === id) ?? CONSOLES[0]!;
}
