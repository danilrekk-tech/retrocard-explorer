const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const catalog = require("./catalog");

function toId(input) {
  return crypto.createHash("md5").update(input).digest("hex").slice(0, 12);
}

/**
 * Строит план перемещений на основе результата сканирования: для каждого
 * ROM'а, чья текущая папка не совпадает с ожидаемой папкой его системы,
 * предлагается перемещение. Ничего не меняется на диске на этом шаге.
 */
function buildOrganizationPlan(rootPath, scan) {
  const moves = [];
  const warnings = [];
  const foldersToCreate = new Set();
  let totalBytes = 0;

  const firstRoot = (scan.romsRoots || []).find((r) => !r.systemId);
  const baseDir = firstRoot ? firstRoot.path : "roms";
  for (const rom of scan.roms) {
    // Папки, которым пользователь назначил платформу, не трогаем.
    if ((scan.romsRoots || []).some((r) => r.systemId && rom.path.startsWith(r.path + "/"))) continue;
    const meta = catalog.systemMeta(rom.systemId);
    const expectedDir = path.posix.join(baseDir, meta.folder);
    const currentDir = path.posix.dirname(rom.path);

    if (rom.systemId === "unknown") {
      warnings.push(`Не удалось определить систему для «${rom.fileName}» — потребуется ручная проверка.`);
      continue;
    }

    if (currentDir !== expectedDir) {
      moves.push({
        id: toId(rom.id + expectedDir),
        action: "move",
        fileName: rom.fileName,
        from: rom.path,
        to: path.posix.join(expectedDir, rom.fileName),
        systemId: rom.systemId,
        sizeBytes: rom.sizeBytes,
        confidence: currentDir.includes(meta.folder) ? 0.7 : 0.95,
        reason:
          currentDir === "roms"
            ? `Файл лежит прямо в /roms, а не в папке системы «${meta.short}»`
            : `Расширение «.${rom.format.toLowerCase()}» соответствует системе «${meta.name}»`,
      });
      foldersToCreate.add(expectedDir);
      totalBytes += rom.sizeBytes;
    }
  }

  for (const uf of scan.unknownFiles) {
    warnings.push(`Файл «${uf.path}» не распознан и не будет перемещён автоматически: ${uf.reason}`);
  }

  return {
    id: toId(rootPath + Date.now()),
    createdAt: new Date().toISOString(),
    moves,
    warnings,
    foldersToCreate: [...foldersToCreate],
    totalBytes,
  };
}

/** Применяет план: реально перемещает файлы на карте. Вызывается только после подтверждения пользователем. */
function applyOrganizationPlan(rootPath, plan, onProgress) {
  const emit = (percent, message) => onProgress && onProgress({ phase: "apply", percent, message });
  const log = [];
  let applied = 0;
  let failed = 0;

  const total = plan.moves.length || 1;
  plan.moves.forEach((move, idx) => {
    const from = path.join(rootPath, ...move.from.split("/"));
    const to = path.join(rootPath, ...move.to.split("/"));
    try {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      if (fs.existsSync(to)) {
        throw new Error("Файл с таким именем уже существует в целевой папке");
      }
      fs.renameSync(from, to);
      applied += 1;
      log.push(`OK  ${move.from} → ${move.to}`);
    } catch (err) {
      failed += 1;
      log.push(`FAIL ${move.from} → ${move.to} (${err.message})`);
    }
    emit(Math.round(((idx + 1) / total) * 100), `Перемещение ${idx + 1} из ${total}: ${move.fileName}`);
  });

  return { ok: failed === 0, applied, failed, log };
}

module.exports = { buildOrganizationPlan, applyOrganizationPlan };
