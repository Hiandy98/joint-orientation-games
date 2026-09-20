import { type Logger } from "pino";
import type { EventEmitter } from "node:events";
import { ServiceRegistry } from "./ServiceRegistry.js";

export interface PluginContext {
  services: ServiceRegistry
  log: Logger
  bus: EventEmitter
  db: any
}