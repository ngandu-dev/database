import type { CollationMetadataProvider } from "../collation-metadata-provider";

export class CachingCollationMetadataProvider implements CollationMetadataProvider {
  private readonly cache = new Map<string, Promise<string | null>>();

  public constructor(private readonly provider: CollationMetadataProvider) {}

  public async getCollationCharset(collation: string): Promise<string | null> {
    if (this.cache.has(collation)) {
      return (await this.cache.get(collation)) ?? null;
    }

    const valuePromise = this.provider.getCollationCharset(collation);
    this.cache.set(collation, valuePromise);
    return (await valuePromise) ?? null;
  }
}
