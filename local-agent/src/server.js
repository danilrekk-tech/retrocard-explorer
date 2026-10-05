#!/usr/bin/env node
/**
 * RetroCard Local Agent
 * ----------------------
 * Локальный HTTP-сервер, который даёт веб-интерфейсу RetroCard Explorer
 * доступ к настоящей microSD-карте на компьютере пользователя.
 *
 * Слушает только 127.0.0.1 — недоступен из сети. Реализует контракт
 * LocalAgentClient из src/lib/agent/client.ts проекта retrocard-explorer.
 *
 * Операции с прогрессом (scan, organize/apply, delete, backup/create)
 * стримят построчный NDJSON: каждая строка — JSON-объект
 *   {"type":"progress","phase":...,"percent":...,"message":...}
 * последняя строка — результат:
 *   {"type":"result","data":...}  либо  {"type":"error","message":...}
 */
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const pkg = require("../package.json");
const catalog = require("./lib/catalog");
const { listRemovableDrives } = require("./lib/drives");
const { scanCard } = require("./lib/scan");
const { buildOrganizationPlan, applyOrganizationPlan } = require("./lib/organize");
const { previewCleanup, deletePaths } = require("./lib/cleaner");
const { listBackups, createBackup } = require("./lib/backup");
const { buildSetupPlan } = require("./lib/setup");
const { buildMigrationPlan } = require("./lib/migrate");

const PORT = Number(process.env.AGENT_PORT || 7345);
const HOST = "127.0.0.1";

const state = {
  connectionState: "disconnected", // disconnected | connecting | connected | error
  rootPath: null,
  consoleId: "rg353v",
  lastScan: null,
  message: undefined,
};

function agentStatus() {
  return {
    state: state.connectionState,
    version: pkg.version,
    transport: "http",
    host: `${HOST}:${PORT}`,
    message: state.message,
  };
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "50mb" }));

// ---- helpers ---------------------------------------------------------

function requireConnected(req, res, next) {
  if (state.connectionState !== "connected" || !state.rootPath) {
    return res.status(409).json({ error: "Агент не подключён к карте. Вызовите /api/connect." });
  }
  next();
}

/** Запускает долгую операцию и стримит NDJSON: progress* -> result|error. */
function streamOperation(res, work) {
  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
  });
  const onProgress = (event) => {
    res.write(JSON.stringify({ type: "progress", ...event }) + "\n");
  };
  try {
    const result = work(onProgress);
    Promise.resolve(result)
      .then((data) => {
        res.write(JSON.stringify({ type: "result", data }) + "\n");
        res.end();
      })
      .catch((err) => {
        res.write(JSON.stringify({ type: "error", message: String(err && err.message ? err.message : err) }) + "\n");
        res.end();
      });
  } catch (err) {
    res.write(JSON.stringify({ type: "error", message: String(err && err.message ? err.message : err) }) + "\n");
    res.end();
  }
}

// ---- status / connection ---------------------------------------------

app.get("/api/status", (_req, res) => res.json(agentStatus()));

app.get("/api/drives", (_req, res) => {
  res.json(listRemovableDrives());
});

app.post("/api/connect", (req, res) => {
  const { path: requestedPath, consoleId } = req.body || {};
  state.connectionState = "connecting";

  let targetPath = requestedPath;
  if (!targetPath) {
    const drives = listRemovableDrives();
    if (drives.length === 0) {
      state.connectionState = "error";
      state.message = "Съёмный накопитель не найден. Подключите SD-карту или укажите путь вручную.";
      return res.status(404).json(agentStatus());
    }
    targetPath = drives[0].path;
  }

  if (!fs.existsSync(targetPath)) {
    state.connectionState = "error";
    state.message = `Путь не найден: ${targetPath}`;
    return res.status(404).json(agentStatus());
  }

  state.rootPath = targetPath;
  state.consoleId = consoleId || state.consoleId;
  state.connectionState = "connected";
  state.message = undefined;
  res.json(agentStatus());
});

app.post("/api/disconnect", (_req, res) => {
  state.connectionState = "disconnected";
  state.rootPath = null;
  state.lastScan = null;
  res.json(agentStatus());
});

// ---- catalog -----------------------------------------------------------

app.get("/api/consoles", (_req, res) => {
  res.json(catalog.CONSOLES);
});

// ---- scan ---------------------------------------------------------------

app.post("/api/scan", requireConnected, (_req, res) => {
  streamOperation(res, (onProgress) => {
    const result = scanCard(state.rootPath, state.consoleId, onProgress);
    state.lastScan = result;
    return result;
  });
});

// ---- organizer -----------------------------------------------------------

app.post("/api/organize/plan", requireConnected, (req, res) => {
  const scan = (req.body && req.body.scan) || state.lastScan;
  if (!scan) return res.status(400).json({ error: "Нет данных сканирования. Сначала выполните /api/scan." });
  res.json(buildOrganizationPlan(state.rootPath, scan));
});

app.post("/api/organize/apply", requireConnected, (req, res) => {
  const { plan } = req.body || {};
  if (!plan) return res.status(400).json({ error: "Не передан план (plan)." });
  streamOperation(res, (onProgress) => applyOrganizationPlan(state.rootPath, plan, onProgress));
});

// ---- cleaner -----------------------------------------------------------

app.post("/api/cleaner/preview", requireConnected, (req, res) => {
  const scan = (req.body && req.body.scan) || state.lastScan;
  const filters = (req.body && req.body.filters) || {};
  if (!scan) return res.status(400).json({ error: "Нет данных сканирования. Сначала выполните /api/scan." });
  res.json(previewCleanup(state.rootPath, scan, filters));
});

app.post("/api/delete", requireConnected, (req, res) => {
  const { paths } = req.body || {};
  if (!Array.isArray(paths) || paths.length === 0) {
    return res.status(400).json({ error: "Не переданы пути для удаления (paths)." });
  }
  streamOperation(res, (onProgress) => deletePaths(state.rootPath, paths, onProgress));
});

// ---- backup -----------------------------------------------------------

app.get("/api/backups", (_req, res) => {
  res.json(listBackups());
});

app.post("/api/backup/create", requireConnected, (req, res) => {
  const { includes } = req.body || {};
  if (!Array.isArray(includes) || includes.length === 0) {
    return res.status(400).json({ error: "Не передан список includes." });
  }
  streamOperation(res, (onProgress) => createBackup(state.rootPath, includes, onProgress));
});

// ---- setup / migration ---------------------------------------------------

app.post("/api/setup/plan", (req, res) => {
  const { consoleId, firmwareId, cardSizeGb } = req.body || {};
  if (!consoleId || !firmwareId || !cardSizeGb) {
    return res.status(400).json({ error: "Нужны consoleId, firmwareId, cardSizeGb." });
  }
  res.json(buildSetupPlan({ consoleId, firmwareId, cardSizeGb }));
});

app.post("/api/migrate/plan", (req, res) => {
  const { from, to } = req.body || {};
  if (!from || !to) return res.status(400).json({ error: "Нужны from и to." });
  res.json(buildMigrationPlan(from, to));
});

// ---- human-friendly status page ---------------------------------------

app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html><html><head><meta charset="utf-8"><title>RetroCard Local Agent</title>
  <style>body{font-family:system-ui,sans-serif;background:#0b0e14;color:#e6e8ee;padding:40px;max-width:640px;margin:0 auto}
  code{background:#1a1f2b;padding:2px 6px;border-radius:4px}
  .ok{color:#5eead4}.dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#5eead4;margin-right:8px}</style>
  </head><body>
  <h1>🎮 RetroCard Local Agent</h1>
  <p><span class="dot"></span><span class="ok">Работает</span> на <code>${HOST}:${PORT}</code></p>
  <p>Версия: <code>${pkg.version}</code> · Статус карты: <code>${state.connectionState}</code></p>
  <p>Откройте <a style="color:#93c5fd" href="https://retrocard-explorer.lovable.app" target="_blank">RetroCard Explorer</a> и нажмите «Connect» — интерфейс подключится к этому агенту автоматически.</p>
  <p style="opacity:.6">Не закрывайте это окно, пока пользуетесь RetroCard. Чтобы остановить агента — закройте окно или нажмите Ctrl+C.</p>
  </body></html>`);
});

app.listen(PORT, HOST, () => {
  console.log("");
  console.log("  🎮  RetroCard Local Agent");
  console.log(`  ────────────────────────────────`);
  console.log(`  Версия:   ${pkg.version}`);
  console.log(`  Адрес:    http://${HOST}:${PORT}`);
  console.log(`  Статус:   ${state.connectionState}`);
  console.log("");
  console.log("  Откройте RetroCard Explorer в браузере и нажмите Connect.");
  console.log("  Чтобы остановить агента — закройте это окно (Ctrl+C).");
  console.log("");

  const drives = listRemovableDrives();
  if (drives.length > 0) {
    console.log("  Найденные съёмные накопители:");
    for (const d of drives) {
      console.log(`   • ${d.path}  ${d.label ? `(${d.label})` : ""}`);
    }
  } else {
    console.log("  Съёмные накопители не найдены — подключите SD-карту.");
  }
  console.log("");
});
