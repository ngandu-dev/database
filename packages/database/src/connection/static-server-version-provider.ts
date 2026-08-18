import type { ServerVersionProvider } from "../server-version-provider";

export class StaticServerVersionProvider implements ServerVersionProvider {
  constructor(private readonly version: string) {}

  public getServerVersion(): string {
    return this.version;
  }
}
