import type { CharsetMetadataProvider } from "../charset-metadata-provider";

export class CachingCharsetMetadataProvider implements CharsetMetadataProvider {
  private readonly cache = new Map<string, Promise<string | null>>();

  public constructor(private readonly provider: CharsetMetadataProvider) {}

  public async getDefaultCharsetCollation(charset: string): Promise<string | null> {
    if (this.cache.has(charset)) {
      return (await this.cache.get(charset)) ?? null;
    }

    const valuePromise = this.provider.getDefaultCharsetCollation(charset);
    this.cache.set(charset, valuePromise);
    return (await valuePromise) ?? null;
  }
}
