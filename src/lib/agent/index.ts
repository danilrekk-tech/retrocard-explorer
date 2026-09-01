/**
 * Точка входа сервисного слоя.
 *
 * Чтобы подключить реальный RetroCard Local Agent, достаточно реализовать
 * `LocalAgentClient` (например, HttpAgentClient c fetch на 127.0.0.1:7345)
 * и вернуть его из `getAgent()` — UI останется без изменений.
 */
import type { LocalAgentClient } from "./client";
import { MockAgentClient } from "./mock-agent";

let instance: LocalAgentClient | null = null;

export function getAgent(): LocalAgentClient {
  if (!instance) instance = new MockAgentClient();
  return instance;
}

/** Для тестов/будущей замены реализации. */
export function setAgent(client: LocalAgentClient) {
  instance = client;
}

export type { LocalAgentClient };
export * from "./types";
export { CONSOLES, FIRMWARE_LABELS, SYSTEMS, systemMeta, consoleProfile, BIOS_REQUIREMENTS } from "./catalog";
