import { Hono } from 'hono'
import type { PluginContext } from './PluginContext.js'

export abstract class BasePlugin {

  public static readonly pluginId: string = ''
  public static readonly pluginName: string = ''
  
  public readonly dependsOn: string[] = []

  public router = new Hono()
  private autoCleanupFns: Array<() => void | Promise<void>> = []  // 防止記憶體洩漏用的(保證生命週期釋放)
  
  constructor(protected ctx: PluginContext) { }

  public async init(): Promise<void> {
    await this.onInit()
    this.setupRoutes()
  }

  public async destroy(): Promise<void> {
    await this.onDestroy()

    await Promise.all(this.autoCleanupFns.map(async (cleanup) => {
      try {
        await cleanup();
      } catch (err) {
        this.ctx.log?.error(err, "Failed to execute cleanup function");
      }
    }));

    this.autoCleanupFns = []
  }
  
  public async ready(): Promise<void> {
    await this.onReady()
  }
  
  protected trackCleanup(cleanupFn: () => void | Promise<void>) {
    this.autoCleanupFns.push(cleanupFn);
  }

  protected onEvent(event: string, handler: (payload: Record<string, any>) => void) {
    this.ctx.bus.on(event, handler)
    this.autoCleanupFns.push(() => {
      this.ctx.bus.off(event, handler)
    })
  }

  protected emitEvent(event: string, payload: Record<string, any> = {}) {
    this.ctx.bus.emit(event, payload)
  }

  protected registerService(serviceName: string, serviceImpl: any) {
    this.ctx.services.register(serviceName, serviceImpl)
  }

  protected getService<T = any>(serviceName: string): T | undefined {
    return this.ctx.services.get(serviceName)
  }

  protected get db() {
    return this.ctx.db
  }

  protected async onInit(): Promise<void> {}
  protected async onDestroy(): Promise<void> {}
  protected async onReady(): Promise<void> {}
  protected abstract setupRoutes(): void
}