export interface ServerVersionProvider {
  getServerVersion(): string | Promise<string>;
}
