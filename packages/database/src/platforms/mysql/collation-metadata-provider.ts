export interface CollationMetadataProvider {
  getCollationCharset(collation: string): Promise<string | null>;
}
