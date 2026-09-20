import { Hono } from "hono"
import * as fs from "node:fs/promises"

import { type PluginContext } from "../contracts/PluginContext.js"
import { PluginScan } from "../utils/PluginScan.js"
import { PluginBootstrapper } from "../utils/PluginBootstrapper.js";

export class PluginLoader {
  private app: Hono
  private ctx: PluginContext

  constructor(app: Hono, ctx: PluginContext) {
    this.app = app
    this.ctx = ctx
  }

  public async loadFromDir(dirPath: string): Promise<void> {
    const registry = new PluginScan(this.ctx);
    const bootstrapper = new PluginBootstrapper(this.app, this.ctx);
    
    const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.isDirectory()) await registry.scanFolder(dirPath, entry.name);
    }
    await bootstrapper.run(registry.getClassMap(), registry.getDepMap());
  }
}