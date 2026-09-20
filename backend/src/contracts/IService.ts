export interface IService {
  register(serviceName: string, serviceImpl: unknown): void
  get<T = unknown>(serviceName: string): T | undefined
}