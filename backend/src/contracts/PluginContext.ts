import { type Logger } from "pino";

export interface PluginContext {
  service: any
  event: any
  log: Logger
}