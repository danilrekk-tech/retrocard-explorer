const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { agentDataDir } = require("./drives");

function manifestPath() {
  return path.join(agentDataDir(), "backups", "manifest.json");
}

function backupsDir() {
  const dir = path.join(agentDataDir(), "backups");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(manifestPath(), "utf8"));
  } catch {
    return [];
  }
}

function writeManifest(list) {
  fs.mkdirSync(path.dirname(manifestPath()), { recursive: true });
  fs.writeFileSync(manifestPath(), JSON.stringify(list, null, 2));
}

function listBackups() {
  return readManifest();
}

/**
 * Создаёт zip-архив выбранных top-level папок карты (например ["bios","saves"]).
 * includes — относительные пути от корня карты, которые нужно включить.
 */
function createBackup(rootPath, includes, onProgress) {
  return new Promise((resolve, reject) => {
    const emit = (percent, message) => onProgress && onProgress({ phase: "backup", percent, message });
    const id = "bak_" + Date.now();
    const label = `Backup ${new Date().toLocaleString("ru-RU")}`;
    const outDir = backupsDir();
    const outFile = path.join(outDir, `${id}.zip`);

    emit(2, "Подготовка архива");
    const output = fs.createWriteStream(outFile);
    const archive = archiver("zip", { zlib: { level: 6 } });

    let fileCount = 0;

    archive.on("entry", (entry) => {
      fileCount += 1;
      emit(Math.min(95, 5 + fileCount), `Добавление: ${entry.name}`);
    });

    output.on("close", () => {
      const entry = {
        id,
        label,
        createdAt: new Date().toISOString(),
        sizeBytes: archive.pointer(),
        fileCount,
        status: "complete",
        includes,
      };
      const manifest = readManifest();
      manifest.unshift(entry);
      writeManifest(manifest);
      emit(100, "Резервная копия создана");
      resolve(entry);
    });

    archive.on("error", (err) => reject(err));
    archive.pipe(output);

    for (const rel of includes) {
      const full = path.join(rootPath, ...rel.split("/"));
      if (!fs.existsSync(full)) continue;
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        archive.directory(full, rel);
      } else {
        archive.file(full, { name: rel });
      }
    }

    archive.finalize();
  });
}

module.exports = { listBackups, createBackup };
