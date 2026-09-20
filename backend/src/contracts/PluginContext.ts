import { type Logger } from "pino";
import type { EventEmitter } from "node:events";

export interface PluginContext {
  services: any
  log: Logger
  bus: EventEmitter
  db: any
}