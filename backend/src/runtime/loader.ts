import { Hono } from "hono"

import { type PluginContext } from "../contracts/PluginContext.js"
import { BasePlugin } from "../contracts/BasePlugin.js"

export class PluginLoader {
  private loadedPlugins: BasePlugin[] = []
  private app: Hono
  private ctx: PluginContext

  constructor(app: Hono, ctx: PluginContext) {
    this.app = app
    this.ctx = ctx
  }
}