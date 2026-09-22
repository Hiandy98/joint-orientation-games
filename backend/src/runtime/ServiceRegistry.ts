import { type Logger } from "pino";
import type { IService } from "../contracts/IService.js";

export class ServiceRegistry implements IService {
  private services = new Map<string, any>();
  private log!: Logger;

  constructor(log: Logger) {
    this.log = log;
  }

  public register(serviceName: string, serviceImpl: any): void {
    this.services.set(serviceName, serviceImpl);
    this.log.info(`Service: [${serviceName}], register successfully`);
  }

  public get<T = unknown>(serviceName: string): T | undefined {
    return this.services.get(serviceName) as T | undefined;
  }
}