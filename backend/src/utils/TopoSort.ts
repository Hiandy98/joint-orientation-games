import { error } from "node:console";
import { baseLogger } from "../runtime/logger.js";

export class TopoSort {

    private visited: Map<string, number> = new Map();
    private dependencies: Map<string, string[]> = new Map();
    private errors: string[] = new Array();
    private plugins: string[] = new Array();
    private sortResult: string[] = new Array();
    
    // important: 需要保證所有的依賴val存在於一個key中

    constructor(pluginDependencies: Map<string, string[]>) {
        this.dependencies = pluginDependencies;
        this.setPlugins();
    }

    public sort(): string[] {
        for (const plugin of this.plugins) {
            if (!this.visited.has(plugin)) {
                this.dfs(plugin);
            }
        }
        if(!(this.errors.length === 0)){
            this.sendLog();
            process.exit(1);
        }
        return this.sortResult;
    }

    private setPlugins(): void {
        for(const [pluginName, d] of this.dependencies.entries()){
            this.plugins.push(pluginName);
        }
    }

    private dfs(plugin: string): void {
        this.visited.set(plugin, 1);
        const depends = this.dependencies.get(plugin) || [];

        for (const depend of depends) {
            if(this.visited.get(depend) == 1) {
                this.pushError("循環依賴", depend);
                continue;
            }
            if(!this.plugins.includes(depend)) {
                this.pushError("不存在模組", depend);
                continue;
            }
            if (!this.visited.has(depend)) {
                this.dfs(depend);
            }
        }
        this.sortResult.push(plugin);
        this.visited.set(plugin, 2);
    }

    private pushError(errorName: string, errorPos: string): void {
        let errorText = `TopoSort: ${errorName}, error from ${errorPos}`;
        this.errors.push(errorText);
    }

    private sendLog(): void {
        for (const err of this.errors){
            baseLogger.info(err);
        }
    }
}