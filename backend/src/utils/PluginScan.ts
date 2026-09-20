import * as path from "node:path"
import { pathToFileURL } from "node:url"

import { BasePlugin } from "../contracts/BasePlugin.js"
import { type PluginContext } from "../contracts/PluginContext.js";

export class PluginScan {
  private classMap = new Map<string, typeof BasePlugin>();
  private depMap = new Map<string, string[]>();
  constructor(private ctx: PluginContext) {}

  public async scanFolder(dir: string, folder: string): Promise<void> {
    const entryFile = path.resolve(dir, folder, "index.js");
    try {
      const module = await import(pathToFileURL(entryFile).href);
      this.validateAndRegister(module.default, folder);
    } catch (err) {
      this.ctx.log.error(err, `Loader: Unable to import plugin file: ${entryFile}`);
    }
  }
  
  private validateAndRegister(PluginClass: any, folder: string): void {
    if (!PluginClass || !(PluginClass.prototype instanceof BasePlugin)) {
      return this.ctx.log.warn(`Loader: Skip exporting invalid add-ons: ${folder}`);
    }
    const id = PluginClass.pluginId; 
    if (!id) return this.ctx.log.error(`Loader: Plugin undefined, pluginId: ${folder}`);
    
    this.classMap.set(id, PluginClass);
    this.depMap.set(id, PluginClass.dependsOn ?? []);
  }

  public getClassMap() { return this.classMap; }
  public getDepMap() { return this.depMap; }
}