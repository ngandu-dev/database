export interface CharsetMetadataProvider {
  getDefaultCharsetCollation(charset: string): Promise<string | null>;
}
