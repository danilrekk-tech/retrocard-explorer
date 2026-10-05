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
function detectFirmware(rootPath) {
  const results = [];

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

  if (!best || best.score < 0.15) {
    return { id: "unknown", name: "Unknown", version: null, evidence: ["Не удалось распознать структуру прошивки"], confidence: 0 };
  }

  const names = { arkos: "ArkOS", rocknix: "ROCKNIX", jelos: "JELOS", stock: "Stock OS", unknown: "Unknown" };
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

module.exports = { detectFirmware, findRomsRoot, findBiosRoot, findSavesRoot, existsCI };
