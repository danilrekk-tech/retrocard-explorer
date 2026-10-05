const fs = require("fs");
const path = require("path");

/** Предпросмотр очистки по фильтрам. Ничего не удаляет — только считает. */
function previewCleanup(rootPath, scan, filters) {
  const items = [];
  const beforeFiles = scan.roms.length + scan.unknownFiles.length;
  const beforeBytes = scan.roms.reduce((s, r) => s + r.sizeBytes, 0) + scan.unknownFiles.reduce((s, u) => s + u.sizeBytes, 0);

  if (filters.removeDuplicates) {
    for (const group of scan.duplicates) {
      for (const item of group.items) {
        if (!item.recommendedKeep) {
          items.push({ path: item.path, sizeBytes: item.sizeBytes, reason: `Дубликат («${group.title}») — рекомендовано оставить другую копию` });
        }
      }
    }
  }

  if (filters.removeUnknown) {
    for (const uf of scan.unknownFiles) {
      items.push({ path: uf.path, sizeBytes: uf.sizeBytes, reason: uf.reason });
    }
  }

  if (filters.systems && filters.systems.length > 0) {
    for (const rom of scan.roms) {
      if (filters.systems.includes(rom.systemId)) {
        // если система в списке "к удалению" — это отдельный явный выбор пользователя
      }
    }
  }

  if (filters.regions && filters.regions.length > 0) {
    for (const rom of scan.roms) {
      if (rom.region && filters.regions.includes(rom.region)) {
        items.push({ path: rom.path, sizeBytes: rom.sizeBytes, reason: `Регион «${rom.region}» отмечен для удаления` });
      }
    }
  }

  if (filters.removeAltVersions) {
    for (const group of scan.duplicates) {
      if (group.kind === "version") {
        for (const item of group.items) {
          if (!item.recommendedKeep) {
            items.push({ path: item.path, sizeBytes: item.sizeBytes, reason: "Альтернативная версия игры" });
          }
        }
      }
    }
  }

  // убрать дубли в списке items (файл мог попасть под несколько фильтров)
  const seen = new Map();
  for (const it of items) {
    if (!seen.has(it.path)) seen.set(it.path, it);
  }
  const dedupedItems = [...seen.values()];

  const freedBytes = dedupedItems.reduce((s, i) => s + i.sizeBytes, 0);

  return {
    before: { files: beforeFiles, usedBytes: beforeBytes },
    after: { files: beforeFiles - dedupedItems.length, usedBytes: beforeBytes - freedBytes },
    freedBytes,
    items: dedupedItems,
  };
}

/** Удаляет явно подтверждённые пользователем пути. Ничего не удаляется автоматически. */
function deletePaths(rootPath, paths, onProgress) {
  const emit = (percent, message) => onProgress && onProgress({ phase: "delete", percent, message });
  const log = [];
  let applied = 0;
  let failed = 0;
  const total = paths.length || 1;

  paths.forEach((relPath, idx) => {
    const full = path.join(rootPath, ...relPath.split("/"));
    try {
      fs.rmSync(full, { force: false });
      applied += 1;
      log.push(`OK  удалено: ${relPath}`);
    } catch (err) {
      failed += 1;
      log.push(`FAIL ${relPath} (${err.message})`);
    }
    emit(Math.round(((idx + 1) / total) * 100), `Удаление ${idx + 1} из ${total}`);
  });

  return { ok: failed === 0, applied, failed, log };
}

module.exports = { previewCleanup, deletePaths };
