import { type Logger } from "pino";

export interface PluginContext {
  services: any
  event: any
  log: Logger
  bus: any
  db: any
}