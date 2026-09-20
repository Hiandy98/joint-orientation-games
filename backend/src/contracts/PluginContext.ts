import { type Logger } from "pino";
import type { EventEmitter } from "node:events";
import type { IService } from "./IService.js";

export interface PluginContext {
  services: IService
  log: Logger
  bus: EventEmitter
  db: any
}