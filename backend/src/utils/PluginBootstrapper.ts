import { Hono } from "hono"

import { type PluginContext } from "../contracts/PluginContext.js"
import { BasePlugin } from "../contracts/BasePlugin.js"
import { TopoSort } from "../utils/TopoSort.js"


export class PluginBootstrapper {
  private loadedPlugins: BasePlugin[] = []
  private app: Hono
  private ctx: PluginContext
  
  constructor(app: Hono, ctx: PluginContext) {
    this.app = app
    this.ctx = ctx
  }

  public async run(classMap: Map<string, typeof BasePlugin>, depMap: Map<string, string[]>): Promise<void> {
    const sortedIds = new TopoSort(depMap).sort();
    await this.initializeAll(sortedIds, classMap);
    await this.activateAllReady();
  }

  private async initializeAll(sortedIds: string[], classMap: Map<string, typeof BasePlugin>): Promise<void> {
    for (const id of sortedIds) {
      const PluginClass = classMap.get(id);
      if (PluginClass) await this.bootPlugin(id, PluginClass);
    }
  }

  private async bootPlugin(id: string, PluginClass: typeof BasePlugin): Promise<void> {
    const name = PluginClass.prototype.pluginName || id;
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
      this.ctx.log.error(err, `Loader: Failed to execute onReady for plugin [${plugin.pluginId}]`);
    }
  }
}