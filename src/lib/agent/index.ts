/**
 * Точка входа сервисного слоя.
 *
 * В демо-режиме используется MockAgentClient (виртуальная карта),
 * в режиме "local" — HttpAgentClient, который общается с RetroCard
 * Local Agent на компьютере пользователя (по умолчанию 127.0.0.1:7345).
 */
import type { LocalAgentClient } from "./client";
import { MockAgentClient } from "./mock-agent";
import { HttpAgentClient } from "./http-agent";
import { getAgentMode, getAgentUrl, type AgentMode } from "./mode";

let instance: LocalAgentClient | null = null;
let instanceMode: AgentMode | null = null;
let instanceUrl: string | null = null;

export function getAgent(): LocalAgentClient {
  const mode = getAgentMode();
  const url = getAgentUrl();
  if (!instance || instanceMode !== mode || (mode === "local" && instanceUrl !== url)) {
    instance = mode === "local" ? new HttpAgentClient(url) : new MockAgentClient();
    instanceMode = mode;
    instanceUrl = url;
  }
  return instance;
}

/** Сбросить кэш клиента (после смены режима или адреса агента). */
export function resetAgent() {
  instance = null;
  instanceMode = null;
  instanceUrl = null;
}

/** Для тестов/будущей замены реализации. */
export function setAgent(client: LocalAgentClient) {
  instance = client;
  instanceMode = null;
  instanceUrl = null;
}

export type { LocalAgentClient };
export * from "./types";
export { HttpAgentClient, DEFAULT_AGENT_URL } from "./http-agent";
export type { AgentDrive } from "./http-agent";
export { getAgentMode, setAgentMode, getAgentUrl, setAgentUrl } from "./mode";
export type { AgentMode } from "./mode";
export { CONSOLES, FIRMWARE_LABELS, SYSTEMS, systemMeta, consoleProfile, BIOS_REQUIREMENTS } from "./catalog";
