import { Hono } from "hono"
import * as fs from "node:fs/promises"
import * as path from "node:path"

import { type PluginContext } from "../contracts/PluginContext.js"
import { BasePlugin } from "../contracts/BasePlugin.js"
import { TopoSort } from "../utils/TopoSort.js"

export class PluginLoader {
  private loadedPlugins: BasePlugin[] = []
  private app: Hono
  private ctx: PluginContext

  constructor(app: Hono, ctx: PluginContext) {
    this.app = app
    this.ctx = ctx
  }

  public async loadFromDir(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
    const classMap = new Map<string, typeof BasePlugin>();
    const depMap = new Map<string, string[]>();

    for (const entry of entries) {
      if (entry.isDirectory()) await this.loadPluginClass(dirPath, entry.name, classMap, depMap);
    }
    await this.initializeAll(new TopoSort(depMap).sort(), classMap);
    await this.activateAllReady();
  }

  private async loadPluginClass(dir: string, folder: string, classMap: Map<string, any>, depMap: Map<string, any>): Promise<void> {
    const entryFile = path.join(dir, folder, "index.js");
    try {
      const module = await import(entryFile);
      this.validateAndRegister(module.default, folder, classMap, depMap);
    } catch (err) {
      this.ctx.log.error(err, `Loader: Unable to import plugin file: ${entryFile}`);
    }
  }

  private validateAndRegister(PluginClass: any, folder: string, classMap: Map<string, any>, depMap: Map<string, any>): void {
    if (!PluginClass || !(PluginClass.prototype instanceof BasePlugin)) {
      return this.ctx.log.warn(`Loader: Skip exporting invalid add-ons: ${folder}`);
    }
    const id = PluginClass.pluginId;
    if (!id) return this.ctx.log.error(`Loader: Plugin undefined, static pluginId: ${folder}`);

    classMap.set(id, PluginClass);
    depMap.set(id, PluginClass.dependsOn || []);
  }

  private async initializeAll(sortedIds: string[], classMap: Map<string, typeof BasePlugin>): Promise<void> {
    for (const id of sortedIds) {
      const PluginClass = classMap.get(id);
      if (PluginClass) await this.bootPlugin(id, PluginClass);
    }
  }

  private async bootPlugin(id: string, PluginClass: typeof BasePlugin): Promise<void> {
    const name = PluginClass.name || id;
    try {
      this.ctx.log.info(`Loader: Initializing plugin: ${name} (${id})`);
      const instance = new (PluginClass as any)(this.ctx) as BasePlugin;
      await instance.init();
      this.registerRoute(id, instance);
    } catch (err) {
      this.ctx.log.error(err, `Loader: Failed to start plugin [${id}]`);
      throw err;
    }
  }

  private registerRoute(id: string, instance: BasePlugin): void {
    this.app.route(`/api/${id}`, instance.router);
    this.loadedPlugins.push(instance);
    this.ctx.log.info(`Loader: Route automatically registered: /api/${id}/*`);
  }

  private async activateAllReady(): Promise<void> {
    const tasks = this.loadedPlugins.map(plugin => this.invokeOnReady(plugin));
    await Promise.all(tasks);
  }

  private async invokeOnReady(plugin: any): Promise<void> {
    if (typeof plugin.onReady !== "function") return;
    try {
      await plugin.onReady();
    } catch (err) {
      const id = plugin.pluginId || "unknown";
      this.ctx.log.error(err, `Loader: Failed to execute onReady for plugin [${id}]`);
    }
  }
}