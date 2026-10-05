const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * Список съёмных накопителей (SD-карты, флешки).
 * На Windows — через PowerShell/CIM (DriveType 2 = Removable).
 * На других ОС (для разработки/теста агента) — упрощённый поиск в /media, /mnt, /Volumes.
 */
function listRemovableDrives() {
  if (process.platform === "win32") {
    try {
      const psScript =
        "Get-CimInstance Win32_LogicalDisk | " +
        "Where-Object { $_.DriveType -eq 2 -or $_.DriveType -eq 3 } | " +
        "Select-Object DeviceID,VolumeName,Size,FreeSpace,DriveType | ConvertTo-Json";
      const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", psScript], {
        encoding: "utf8",
        timeout: 8000,
      });
      let parsed = JSON.parse(out || "[]");
      if (!Array.isArray(parsed)) parsed = [parsed];
      return parsed
        .filter((d) => d.DriveType === 2) // только съёмные — SD/USB
        .map((d) => ({
          path: `${d.DeviceID}\\`,
          label: d.VolumeName || d.DeviceID,
          capacityBytes: Number(d.Size) || 0,
          freeBytes: Number(d.FreeSpace) || 0,
          removable: true,
        }));
    } catch {
      return [];
    }
  }

  // Не-Windows: подходит только для локальной разработки самого агента.
  const candidates = ["/media", "/mnt", "/Volumes"].filter((p) => fs.existsSync(p));
  const found = [];
  for (const base of candidates) {
    try {
      for (const entry of fs.readdirSync(base)) {
        const full = path.join(base, entry);
        if (fs.statSync(full).isDirectory()) {
          found.push({ path: full, label: entry, capacityBytes: 0, freeBytes: 0, removable: true });
        }
      }
    } catch {
      // ignore unreadable dirs
    }
  }
  return found;
}

/** Занятое/свободное место для конкретного пути (по букве диска на Windows). */
function getVolumeUsage(targetPath) {
  if (process.platform === "win32") {
    try {
      const driveLetter = path.parse(path.resolve(targetPath)).root.replace(/\\$/, "");
      const psScript = `Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='${driveLetter}'" | Select-Object Size,FreeSpace | ConvertTo-Json`;
      const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", psScript], {
        encoding: "utf8",
        timeout: 8000,
      });
      const parsed = JSON.parse(out || "{}");
      const capacityBytes = Number(parsed.Size) || 0;
      const freeBytes = Number(parsed.FreeSpace) || 0;
      return { capacityBytes, freeBytes, usedBytes: Math.max(0, capacityBytes - freeBytes) };
    } catch {
      return { capacityBytes: 0, freeBytes: 0, usedBytes: 0 };
    }
  }
  try {
    const stats = fs.statfsSync(targetPath);
    const capacityBytes = stats.bsize * stats.blocks;
    const freeBytes = stats.bsize * stats.bfree;
    return { capacityBytes, freeBytes, usedBytes: Math.max(0, capacityBytes - freeBytes) };
  } catch {
    return { capacityBytes: 0, freeBytes: 0, usedBytes: 0 };
  }
}

function agentDataDir() {
  const base = process.env.APPDATA || path.join(os.homedir(), ".retrocard-agent");
  const dir = path.join(base, process.env.APPDATA ? "RetroCardAgent" : "");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Файловая система и метка тома (для карточки SdCardInfo). */
function getVolumeInfo(targetPath) {
  const usage = getVolumeUsage(targetPath);
  if (process.platform === "win32") {
    try {
      const driveLetter = path.parse(path.resolve(targetPath)).root.replace(/\\$/, "");
      const psScript = `Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='${driveLetter}'" | Select-Object VolumeName,FileSystem | ConvertTo-Json`;
      const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", psScript], {
        encoding: "utf8",
        timeout: 8000,
      });
      const parsed = JSON.parse(out || "{}");
      return {
        ...usage,
        label: parsed.VolumeName || driveLetter,
        fileSystem: parsed.FileSystem || "unknown",
        mountPath: driveLetter + "\\",
      };
    } catch {
      return { ...usage, label: path.basename(targetPath) || targetPath, fileSystem: "unknown", mountPath: targetPath };
    }
  }
  return { ...usage, label: path.basename(targetPath) || targetPath, fileSystem: "unknown", mountPath: targetPath };
}

module.exports = { listRemovableDrives, getVolumeUsage, getVolumeInfo, agentDataDir };
