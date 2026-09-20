import { Hono } from "hono"

import { type PluginContext } from "../contracts/PluginContext.js"
import { BasePlugin } from "../contracts/BasePlugin.js"
import { TopoSort } from "./TopoSort.js"
import { type HonoEnv } from "./HonoEnv.js"


export class PluginBootstrapper {
  private loadedPlugins: BasePlugin[] = []
  private app: Hono<HonoEnv, any, any>
  private ctx: PluginContext
  
  constructor(app: Hono<HonoEnv, any, any>, ctx: PluginContext) {
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
    const name = PluginClass.pluginName || id;
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

  private async invokeOnReady(plugin: BasePlugin): Promise<void> {
    try {
      await plugin.ready();
    } catch (err) {
      const PluginClass = plugin.constructor as typeof BasePlugin;
      const id = PluginClass.pluginId || "unknown";
      this.ctx.log.error(err, `Loader: Failed to execute onReady for plugin [${id}]`);
    }
  }

  public async unloadAll(): Promise<void> {
    this.ctx.log.info("Loader: Starting to close all loaded add-ons...");
    const reversePlugins = [...this.loadedPlugins].reverse();

    for (const plugin of reversePlugins) {
      await this.destroyPlugin(plugin);
    }
    this.loadedPlugins.length = 0; 
    this.ctx.log.info("Loader: All plugins have been safely disabled.");
  }

  private async destroyPlugin(plugin: BasePlugin): Promise<void> {
    try {
      await plugin.destroy();
    } catch (err) {
      const PluginClass = plugin.constructor as typeof BasePlugin;
      const id = PluginClass.pluginId || "unknown";
      this.ctx.log.error(err, `Loader: Failure to destroy the plugin: [${id}]`);
    }
  }
}