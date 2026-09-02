/**
 * Режим работы сервисного слоя:
 *  - "demo"  — виртуальная SD-карта (MockAgentClient), ничего не читается с диска;
 *  - "local" — реальный RetroCard Local Agent на компьютере пользователя.
 *
 * Настройки хранятся в localStorage, чтобы выбор сохранялся между сессиями.
 */
import { DEFAULT_AGENT_URL } from "./http-agent";

export type AgentMode = "demo" | "local";

const MODE_KEY = "retrocard.agent.mode";
const URL_KEY = "retrocard.agent.url";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function getAgentMode(): AgentMode {
  return storage()?.getItem(MODE_KEY) === "local" ? "local" : "demo";
}

export function setAgentMode(mode: AgentMode) {
  storage()?.setItem(MODE_KEY, mode);
}

export function getAgentUrl(): string {
  return storage()?.getItem(URL_KEY) || DEFAULT_AGENT_URL;
}

export function setAgentUrl(url: string) {
  storage()?.setItem(URL_KEY, url.trim().replace(/\/$/, "") || DEFAULT_AGENT_URL);
}
