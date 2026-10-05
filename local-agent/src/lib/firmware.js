const fs = require("fs");
const path = require("path");

function exists(root, ...segments) {
  return fs.existsSync(path.join(root, ...segments));
}

function existsCI(root, name) {
  // регистронезависимая проверка (важно на Linux-подобных ФС SD-карт)
  try {
    const entries = fs.readdirSync(root);
    return entries.find((e) => e.toLowerCase() === name.toLowerCase()) || null;
  } catch {
    return null;
  }
}

/**
 * Определение прошивки по характерным файлам/папкам на карте.
 * Это эвристика — карты собираются вручную и признаки могут отличаться,
 * поэтому возвращаем evidence[] и confidence, а не жёсткий вердикт.
 */
const FIRMWARE_NAMES = { arkos: "ArkOS", rocknix: "ROCKNIX", jelos: "JELOS", batocera: "Batocera", muos: "muOS", stock: "Stock OS", unknown: "Unknown" };

function detectFirmware(rootPath, overrideId) {
  if (overrideId && overrideId !== "auto" && FIRMWARE_NAMES[overrideId]) {
    return { id: overrideId, name: FIRMWARE_NAMES[overrideId], version: null, evidence: ["Прошивка указана вручную"], confidence: 1, manual: true };
  }
  const results = [];
  {
    const evidence = []; let score = 0;
    if (existsCI(rootPath, "batocera") || existsCI(rootPath, "batocera-boot.conf") || existsCI(rootPath, "boot")) { evidence.push("Маркер Batocera"); score += 0.3; }
    if (existsCI(rootPath, "batocera-boot.conf")) score += 0.4;
    if (score > 0) results.push({ id: "batocera", score, evidence });
  }
  {
    const evidence = []; let score = 0;
    if (existsCI(rootPath, "MUOS")) { evidence.push("Найдена папка /MUOS"); score += 0.7; }
    if (existsCI(rootPath, "ROMS") === "ROMS") { evidence.push("Найдена папка /ROMS"); score += 0.1; }
    if (score > 0) results.push({ id: "muos", score, evidence });
  }

  // ArkOS: /roms, /bios, /saves, /ports + характерный /EASYROMS или /ArkOS
  {
    const evidence = [];
    let score = 0;
    if (existsCI(rootPath, "roms")) { evidence.push("Найдена папка /roms"); score += 0.2; }
    if (existsCI(rootPath, "bios")) { evidence.push("Найдена папка /bios"); score += 0.1; }
    if (existsCI(rootPath, "ports")) { evidence.push("Найдена папка /ports"); score += 0.15; }
    if (existsCI(rootPath, "ArkOS") || existsCI(rootPath, "EASYROMS")) { evidence.push("Маркер ArkOS/EASYROMS"); score += 0.4; }
    if (existsCI(rootPath, "retroarch.cfg")) { evidence.push("Найден retroarch.cfg в корне"); score += 0.1; }
    if (score > 0) results.push({ id: "arkos", score, evidence });
  }

  // ROCKNIX: /roms, /storage, /system, характерный README/version файл
  {
    const evidence = [];
    let score = 0;
    if (existsCI(rootPath, "roms")) { evidence.push("Найдена папка /roms"); score += 0.15; }
    if (existsCI(rootPath, "storage")) { evidence.push("Найдена папка /storage"); score += 0.25; }
    const readme = existsCI(rootPath, "README - ROCKNIX.txt") || existsCI(rootPath, "rocknix");
    if (readme) { evidence.push("Найден маркер ROCKNIX"); score += 0.5; }
    if (score > 0) results.push({ id: "rocknix", score, evidence });
  }

  // JELOS: похож на ArkOS, но с папкой /roms /bios /saves и маркером JELOS
  {
    const evidence = [];
    let score = 0;
    if (existsCI(rootPath, "roms")) { evidence.push("Найдена папка /roms"); score += 0.15; }
    if (existsCI(rootPath, "bios")) { evidence.push("Найдена папка /bios"); score += 0.1; }
    if (existsCI(rootPath, "saves")) { evidence.push("Найдена папка /saves"); score += 0.1; }
    if (existsCI(rootPath, "JELOS") || existsCI(rootPath, ".jelos")) { evidence.push("Маркер JELOS"); score += 0.5; }
    if (score > 0) results.push({ id: "jelos", score, evidence });
  }

  // Stock OS (Anbernic): папка /Roms (с большой буквы) + EmulationStation
  {
    const evidence = [];
    let score = 0;
    const romsCap = existsCI(rootPath, "Roms");
    if (romsCap === "Roms") { evidence.push("Найдена папка /Roms (регистр Stock OS)"); score += 0.35; }
    if (existsCI(rootPath, "Emu") || existsCI(rootPath, "emuelec")) { evidence.push("Маркер EmuELEC/Stock"); score += 0.3; }
    if (existsCI(rootPath, ".tmp_update")) { evidence.push("Служебная папка Stock OS"); score += 0.2; }
    if (score > 0) results.push({ id: "stock", score, evidence });
  }

  results.sort((a, b) => b.score - a.score);
  const best = results[0];

  if (!best || best.score < 0.4) {
    return { id: "unknown", name: "Unknown", version: null, evidence: ["Не удалось распознать структуру прошивки"], confidence: 0 };
  }

  const names = FIRMWARE_NAMES;
  return {
    id: best.id,
    name: names[best.id],
    version: null,
    evidence: best.evidence,
    confidence: Math.min(0.95, best.score),
  };
}

/** Находит фактическую папку с ROM'ами независимо от регистра (roms / Roms). */
function findRomsRoot(rootPath) {
  const name = existsCI(rootPath, "roms");
  return name ? path.join(rootPath, name) : null;
}

function findBiosRoot(rootPath) {
  const name = existsCI(rootPath, "bios");
  return name ? path.join(rootPath, name) : null;
}

function findSavesRoot(rootPath) {
  const name = existsCI(rootPath, "saves");
  return name ? path.join(rootPath, name) : null;
}

const ROMS_DIR_NAMES = ["roms", "easyroms", "games", "roms2", "sdcard/roms", "mnt/sdcard/roms"];

/** Все вероятные корни ROM'ов: корень карты и до двух уровней вложенности. */
function findRomsRoots(rootPath) {
  const found = [];
  const check = (dir, depth) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith(".")) continue;
      const full = path.join(dir, e.name);
      const low = e.name.toLowerCase();
      if (["roms", "easyroms", "games", "roms2"].includes(low)) found.push(full);
      else if (depth < 2 && !["bios", "saves", "system", "storage"].includes(low)) check(full, depth + 1);
    }
  };
  check(rootPath, 0);
  return found;
}

/** Ручные пути: строки или { path, systemId }, абсолютные или относительно карты. */
function resolveRomsPaths(rootPath, romsPaths) {
  const out = [];
  for (const item of romsPaths || []) {
    const cfg = typeof item === "string" ? { path: item } : item || {};
    if (!cfg.path) continue;
    const rel = String(cfg.path).replace(/^[\\/]+/, "");
    const full = path.isAbsolute(cfg.path) && fs.existsSync(cfg.path) ? cfg.path : path.join(rootPath, rel);
    if (!fs.existsSync(full)) continue;
    out.push({ full, systemId: cfg.systemId && cfg.systemId !== "auto" ? cfg.systemId : null });
  }
  return out;
}

/** Автоопределение консоли по маркерам и прошивке. */
function detectConsole(rootPath, firmwareId) {
  const markers = [
    [/rg353|rk3566|rk3568/i, "rg353v"],
    [/rg35xx|h700|garlic|minui/i, "rg35xx"],
    [/rg405|sm6115|t618/i, "rg405m"],
  ];
  const evidence = [];
  const scan = (dir, depth) => {
    let entries = [];
    try { entries = fs.readdirSync(dir); } catch { return null; }
    for (const name of entries) {
      for (const [re, id] of markers) if (re.test(name)) { evidence.push(`Маркер «${name}»`); return id; }
      if (depth < 1 && /^(boot|dtb|config|system|\.system)$/i.test(name)) {
        const r = scan(path.join(dir, name), depth + 1); if (r) return r;
      }
    }
    return null;
  };
  const byMarker = scan(rootPath, 0);
  if (byMarker) return { id: byMarker, evidence };
  if (firmwareId === "muos" || firmwareId === "stock") return { id: "rg35xx", evidence: ["По прошивке " + firmwareId] };
  if (["arkos", "rocknix", "jelos"].includes(firmwareId)) return { id: "rg353v", evidence: ["По прошивке " + firmwareId] };
  return { id: "generic", evidence: ["Консоль не распознана"] };
}

module.exports = { FIRMWARE_NAMES, findRomsRoots, resolveRomsPaths, detectConsole, detectFirmware, findRomsRoot, findBiosRoot, findSavesRoot, existsCI };
