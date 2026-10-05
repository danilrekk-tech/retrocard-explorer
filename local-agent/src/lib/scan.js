const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { detectFirmware, findRomsRoot, findBiosRoot, findSavesRoot } = require("./firmware");
const { getVolumeInfo } = require("./drives");
const catalog = require("./catalog");

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp"]);
const METADATA_EXT = new Set([".txt", ".cfg", ".xml", ".db", ".nfo", ".ini", ".json", ".srm", ".sav", ".state"]);
const ART_DIR_NAMES = new Set(["images", "media", "imgs", "screenshots", "boxart", "art", "covers"]);

function toId(input) {
  return crypto.createHash("md5").update(input).digest("hex").slice(0, 12);
}

function relPosix(root, p) {
  return path.relative(root, p).split(path.sep).join("/");
}

function allKnownExtensions() {
  const set = new Set();
  for (const key of Object.keys(catalog.SYSTEMS)) {
    for (const ext of catalog.SYSTEMS[key].extensions) set.add(ext);
  }
  return set;
}
const KNOWN_ROM_EXT = allKnownExtensions();

/** Разобрать регион/версию из имени файла: "Game (USA) (Rev 1).gba" */
function parseTitleTags(fileNameNoExt) {
  const tags = [...fileNameNoExt.matchAll(/\(([^)]+)\)|\[([^\]]+)\]/g)].map((m) => (m[1] || m[2] || "").trim());
  let region;
  const regionMap = [
    [/usa/i, "USA"],
    [/europe|eur\b/i, "EUR"],
    [/japan|jpn\b/i, "JPN"],
    [/world/i, "WORLD"],
  ];
  for (const tag of tags) {
    for (const [re, code] of regionMap) {
      if (re.test(tag)) region = code;
    }
  }
  const title = fileNameNoExt.replace(/\s*[\(\[][^\)\]]*[\)\]]/g, "").trim();
  const language = tags.find((t) => /^(en|fr|de|es|it|ja|ru|multi\d*)$/i.test(t));
  return { title: title || fileNameNoExt, region: region || "UNK", language, tags };
}

function normalizeForGrouping(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|a|an)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasArtworkFor(fileDir, baseName) {
  try {
    for (const name of fs.readdirSync(fileDir)) {
      const ext = path.extname(name).toLowerCase();
      if (IMAGE_EXT.has(ext) && path.basename(name, ext).toLowerCase() === baseName.toLowerCase()) return true;
    }
    for (const artDir of ART_DIR_NAMES) {
      const p = path.join(fileDir, artDir);
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        const found = fs.readdirSync(p).some((n) => {
          const ext = path.extname(n).toLowerCase();
          return IMAGE_EXT.has(ext) && path.basename(n, ext).toLowerCase() === baseName.toLowerCase();
        });
        if (found) return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

/** Построить дерево папок (ограничено по глубине/количеству, чтобы не подвесить UI). */
function buildTree(rootPath, maxDepth = 6, maxChildren = 300) {
  function walk(dir, depth) {
    const name = path.basename(dir) || dir;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return { name, kind: "dir", children: [] };
    }
    if (depth >= maxDepth) {
      return { name, kind: "dir", fileCount: entries.length, children: [] };
    }
    const children = [];
    let sizeBytes = 0;
    let fileCount = 0;
    for (const entry of entries.slice(0, maxChildren)) {
      if (entry.name.startsWith(".retrocard")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const child = walk(full, depth + 1);
        children.push(child);
        sizeBytes += child.sizeBytes || 0;
        fileCount += child.fileCount || 0;
      } else {
        let st;
        try {
          st = fs.statSync(full);
        } catch {
          continue;
        }
        sizeBytes += st.size;
        fileCount += 1;
        children.push({ name: entry.name, kind: "file", sizeBytes: st.size });
      }
    }
    return { name, kind: "dir", sizeBytes, fileCount, children };
  }
  return walk(rootPath, 0);
}

function buildRomEntryFromFile(full, dir, entry, ext, systemId) {
  let st;
  try {
    st = fs.statSync(full);
  } catch {
    return null;
  }
  const baseName = path.basename(entry.name, ext);
  const { title, region, language } = parseTitleTags(baseName);
  const problems = [];
  let status = "ok";
  if (st.size === 0) {
    status = "error";
    problems.push("Файл имеет нулевой размер (повреждён)");
  }
  return {
    id: toId(full),
    title,
    systemId,
    fileName: entry.name,
    path: null, // заполняется вызывающим кодом (зависит от romsRoot)
    sizeBytes: st.size,
    format: ext.replace(".", "").toUpperCase(),
    region,
    language,
    hasArtwork: hasArtworkFor(dir, baseName),
    status,
    problems,
    _fullPath: full,
  };
}

function collectRoms(romsRoot, unknownFiles) {
  const roms = [];
  if (!romsRoot || !fs.existsSync(romsRoot)) return roms;

  const topEntries = fs.readdirSync(romsRoot, { withFileTypes: true });
  const systemFolders = topEntries.filter((e) => e.isDirectory());

  // Файлы, лежащие прямо в корне /roms (не разложенные по папкам систем) —
  // классифицируем по расширению и помечаем как требующие перемещения.
  for (const entry of topEntries) {
    if (entry.isDirectory()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (IMAGE_EXT.has(ext) || METADATA_EXT.has(ext)) continue;
    const full = path.join(romsRoot, entry.name);
    const systemId = catalog.systemIdByExtension(ext);
    if (!systemId) {
      let st;
      try {
        st = fs.statSync(full);
      } catch {
        st = { size: 0 };
      }
      unknownFiles.push({
        path: "roms/" + entry.name,
        sizeBytes: st.size,
        reason: "Неопознанное расширение файла прямо в корне /roms",
      });
      continue;
    }
    const rom = buildRomEntryFromFile(full, romsRoot, entry, ext, systemId);
    if (rom) {
      rom.path = "roms/" + entry.name;
      delete rom._fullPath;
      roms.push(rom);
    }
  }

  for (const sysDir of systemFolders) {
    const folderSystemId = catalog.systemIdByFolder(sysDir.name);
    const sysPath = path.join(romsRoot, sysDir.name);

    const walkFiles = (dir) => {
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (ART_DIR_NAMES.has(entry.name.toLowerCase())) continue; // это папки артворка, не роскладка систем
          walkFiles(full);
          continue;
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (IMAGE_EXT.has(ext) || METADATA_EXT.has(ext)) continue; // метаданные/артворк — не ROM

        const isKnownExt = KNOWN_ROM_EXT.has(ext);
        const systemId = folderSystemId || catalog.systemIdByExtension(ext);

        if (!systemId || (!folderSystemId && !isKnownExt)) {
          let st;
          try {
            st = fs.statSync(full);
          } catch {
            st = { size: 0 };
          }
          unknownFiles.push({
            path: relPosix(romsRoot, full).replace(/^/, "roms/"),
            sizeBytes: st.size,
            reason: "Неопознанное расширение файла в папке ROM'ов",
          });
          continue;
        }

        let st;
        try {
          st = fs.statSync(full);
        } catch {
          continue;
        }
        const baseName = path.basename(entry.name, ext);
        const { title, region, language } = parseTitleTags(baseName);
        const problems = [];
        let status = "ok";
        if (st.size === 0) {
          status = "error";
          problems.push("Файл имеет нулевой размер (повреждён)");
        }

        roms.push({
          id: toId(full),
          title,
          systemId: systemId,
          fileName: entry.name,
          path: "roms/" + relPosix(romsRoot, full),
          sizeBytes: st.size,
          format: ext.replace(".", "").toUpperCase(),
          region,
          language,
          hasArtwork: hasArtworkFor(dir, baseName),
          status,
          problems,
        });
      }
    };

    walkFiles(sysPath);
  }

  return roms;
}

function collectBios(biosRoot, consoleId) {
  const consoleProfile = catalog.consoleProfile(consoleId);
  const relevant = catalog.BIOS_REQUIREMENTS.filter((b) => consoleProfile.systems.includes(b.systemId));
  const present = new Set();
  const entries = [];

  if (biosRoot && fs.existsSync(biosRoot)) {
    for (const name of fs.readdirSync(biosRoot)) {
      const full = path.join(biosRoot, name);
      try {
        if (!fs.statSync(full).isFile()) continue;
      } catch {
        continue;
      }
      present.add(name.toLowerCase());
    }
  }

  for (const req of relevant) {
    const found = present.has(req.fileName.toLowerCase());
    let sizeBytes;
    if (found) {
      try {
        sizeBytes = fs.statSync(path.join(biosRoot, req.fileName)).size;
      } catch {
        sizeBytes = undefined;
      }
    }
    entries.push({
      fileName: req.fileName,
      systemId: req.systemId,
      status: found ? "present" : "missing",
      required: req.required,
      sizeBytes,
      note: req.note,
    });
    if (found) present.delete(req.fileName.toLowerCase());
  }

  // Файлы в /bios, которых нет в списке требований — "unused"
  for (const leftover of present) {
    entries.push({
      fileName: leftover,
      systemId: "unknown",
      status: "unused",
      required: false,
      note: "Файл не входит в список известных BIOS для этой консоли",
    });
  }

  return entries;
}

function collectSaves(savesRoot) {
  const saves = [];
  if (!savesRoot || !fs.existsSync(savesRoot)) return saves;

  const walk = (dir, systemHint) => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const sysId = catalog.systemIdByFolder(entry.name) || systemHint;
        walk(full, sysId);
        continue;
      }
      let st;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      saves.push({
        fileName: entry.name,
        systemId: systemHint || "unknown",
        sizeBytes: st.size,
        modifiedAt: st.mtime.toISOString(),
      });
    }
  };
  walk(savesRoot, undefined);
  return saves;
}

function findDuplicates(roms) {
  const groups = new Map();
  for (const rom of roms) {
    const key = rom.systemId + "::" + normalizeForGrouping(rom.title);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rom);
  }

  const duplicates = [];
  for (const [key, items] of groups) {
    if (items.length < 2) continue;

    // exact: одинаковый размер + совпадающий md5
    const bySize = new Map();
    for (const it of items) {
      if (!bySize.has(it.sizeBytes)) bySize.set(it.sizeBytes, []);
      bySize.get(it.sizeBytes).push(it);
    }

    let kind = "similar";
    const regions = new Set(items.map((i) => i.region));
    if (regions.size > 1) kind = "region";
    const sameSizeGroup = [...bySize.values()].find((g) => g.length > 1);
    if (sameSizeGroup) kind = "exact";
    else if (items.some((i) => /rev|v\d|version/i.test(i.fileName))) kind = "version";

    // приоритет для "оставить": USA > WORLD > EUR > JPN > UNK, затем больший размер
    const regionRank = { USA: 0, WORLD: 1, EUR: 2, JPN: 3, UNK: 4 };
    const sorted = [...items].sort((a, b) => {
      const r = (regionRank[a.region] ?? 5) - (regionRank[b.region] ?? 5);
      if (r !== 0) return r;
      return b.sizeBytes - a.sizeBytes;
    });
    const keepId = sorted[0].id;

    const reclaimableBytes = items.filter((i) => i.id !== keepId).reduce((sum, i) => sum + i.sizeBytes, 0);

    duplicates.push({
      id: toId(key),
      kind,
      title: items[0].title,
      systemId: items[0].systemId,
      reclaimableBytes,
      items: items.map((i) => ({
        romId: i.id,
        fileName: i.fileName,
        path: i.path,
        sizeBytes: i.sizeBytes,
        region: i.region,
        label: `${i.fileName} (${i.region || "UNK"})`,
        recommendedKeep: i.id === keepId,
      })),
    });
  }
  return duplicates;
}

function buildProblems({ roms, bios, duplicates, unknownFiles, romsRootFound }) {
  const problems = [];

  if (!romsRootFound) {
    problems.push({
      id: "no-roms-root",
      severity: "critical",
      category: "structure",
      title: "Папка ROMs не найдена",
      detail: "На карте не найдена папка /roms или /Roms — структура не распознана.",
      affected: 0,
    });
  }

  const missingRequiredBios = bios.filter((b) => b.status === "missing" && b.required);
  if (missingRequiredBios.length > 0) {
    problems.push({
      id: "missing-bios",
      severity: "critical",
      category: "bios",
      title: "Отсутствуют обязательные BIOS",
      detail: missingRequiredBios.map((b) => b.fileName).join(", "),
      affected: missingRequiredBios.length,
    });
  }

  const unusedBios = bios.filter((b) => b.status === "unused");
  if (unusedBios.length > 0) {
    problems.push({
      id: "unused-bios",
      severity: "info",
      category: "bios",
      title: "Неиспользуемые файлы BIOS",
      detail: "Найдены файлы в /bios, не входящие в список известных BIOS.",
      affected: unusedBios.length,
    });
  }

  if (duplicates.length > 0) {
    const affected = duplicates.reduce((sum, d) => sum + d.items.length - 1, 0);
    problems.push({
      id: "duplicates",
      severity: "warning",
      category: "duplicates",
      title: "Найдены дубликаты игр",
      detail: `${duplicates.length} групп(ы) дубликатов/версий/регионов.`,
      affected,
    });
  }

  const corrupt = roms.filter((r) => r.status === "error");
  if (corrupt.length > 0) {
    problems.push({
      id: "corrupt-roms",
      severity: "critical",
      category: "structure",
      title: "Повреждённые файлы ROM",
      detail: "Найдены файлы нулевого размера.",
      affected: corrupt.length,
    });
  }

  if (unknownFiles.length > 0) {
    problems.push({
      id: "unknown-files",
      severity: "warning",
      category: "unknown",
      title: "Неопознанные файлы",
      detail: "Файлы с нераспознанным расширением или вне структуры систем.",
      affected: unknownFiles.length,
    });
  }

  return problems;
}

function computeHealth(problems) {
  if (problems.some((p) => p.severity === "critical")) return "critical";
  if (problems.some((p) => p.severity === "warning")) return "warning";
  return "good";
}

/** Небольшой реальный тест скорости чтения/записи прямо на карте. */
function measureSpeed(rootPath) {
  const tmpDir = path.join(rootPath, ".retrocard_tmp");
  const tmpFile = path.join(tmpDir, "speedtest.bin");
  const sizeBytes = 8 * 1024 * 1024;
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    const buf = crypto.randomBytes(sizeBytes);

    const t0 = Date.now();
    fs.writeFileSync(tmpFile, buf);
    const writeMs = Date.now() - t0;

    const t1 = Date.now();
    fs.readFileSync(tmpFile);
    const readMs = Date.now() - t1;

    fs.rmSync(tmpDir, { recursive: true, force: true });

    const mb = sizeBytes / (1024 * 1024);
    return {
      writeSpeedMbs: writeMs > 0 ? Math.round((mb / (writeMs / 1000)) * 10) / 10 : 0,
      readSpeedMbs: readMs > 0 ? Math.round((mb / (readMs / 1000)) * 10) / 10 : 0,
    };
  } catch {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    return { writeSpeedMbs: 0, readSpeedMbs: 0 };
  }
}

function scanCard(rootPath, consoleId, onProgress) {
  const emit = (percent, phase, message) => onProgress && onProgress({ phase, percent, message });
  const startedAt = Date.now();

  emit(2, "volume", "Чтение параметров тома");
  const volume = getVolumeInfo(rootPath);

  emit(8, "firmware", "Определение прошивки");
  const firmware = detectFirmware(rootPath);

  const romsRoot = findRomsRoot(rootPath);
  const biosRoot = findBiosRoot(rootPath);
  const savesRoot = findSavesRoot(rootPath);

  emit(20, "tree", "Построение дерева файлов");
  const tree = buildTree(rootPath);

  emit(40, "roms", "Поиск ROM'ов и каталогизация");
  const unknownFiles = [];
  const roms = collectRoms(romsRoot, unknownFiles);

  emit(62, "bios", "Проверка BIOS");
  const bios = collectBios(biosRoot, consoleId);

  emit(72, "saves", "Проверка сохранений");
  const saves = collectSaves(savesRoot);

  emit(82, "duplicates", "Поиск дубликатов");
  const duplicates = findDuplicates(roms);

  emit(90, "problems", "Анализ проблем");
  const problems = buildProblems({ roms, bios, duplicates, unknownFiles, romsRootFound: !!romsRoot });

  emit(95, "speed", "Замер скорости карты");
  const speed = measureSpeed(rootPath);

  const systemsFound = new Set(roms.map((r) => r.systemId));
  const summary = {
    totalFiles: roms.length + bios.length + saves.length + unknownFiles.length,
    romCount: roms.length,
    systemCount: systemsFound.size,
    biosFound: bios.filter((b) => b.status === "present").length,
    biosMissing: bios.filter((b) => b.status === "missing").length,
    saveCount: saves.length,
    artworkCount: roms.filter((r) => r.hasArtwork).length,
    unknownCount: unknownFiles.length,
    problemCount: problems.length,
    durationMs: Date.now() - startedAt,
    scannedAt: new Date().toISOString(),
  };

  const card = {
    id: toId(rootPath),
    label: volume.label,
    mountPath: volume.mountPath || rootPath,
    fileSystem: volume.fileSystem,
    capacityBytes: volume.capacityBytes,
    usedBytes: volume.usedBytes,
    freeBytes: volume.freeBytes,
    consoleId,
    firmware,
    health: computeHealth(problems),
    readSpeedMbs: speed.readSpeedMbs,
    writeSpeedMbs: speed.writeSpeedMbs,
  };

  emit(100, "done", "Сканирование завершено");
  return { card, summary, roms, bios, saves, problems, tree, unknownFiles, duplicates };
}

module.exports = { scanCard, buildTree, collectRoms, collectBios, collectSaves, findDuplicates };
