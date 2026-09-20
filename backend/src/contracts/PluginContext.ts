import { type Logger } from "pino";
import type { EventEmitter } from "node:events";
import type { IService } from "./IService.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export interface PluginContext {
  services: IService
  log: Logger
  bus: EventEmitter
  db: NodePgDatabase
}