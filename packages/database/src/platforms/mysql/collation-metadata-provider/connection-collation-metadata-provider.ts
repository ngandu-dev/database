import type { Connection } from "../../../connection";
import type { CollationMetadataProvider } from "../collation-metadata-provider";

type MetadataQueryConnection = Pick<Connection, "fetchOne">;

export class ConnectionCollationMetadataProvider implements CollationMetadataProvider {
  public constructor(private readonly connection: MetadataQueryConnection) {}

  public async getCollationCharset(collation: string): Promise<string | null> {
    const charset = await this.connection.fetchOne<string>(
      `SELECT CHARACTER_SET_NAME
FROM information_schema.COLLATIONS
WHERE COLLATION_NAME = ?;`,
      [collation],
    );

    return charset === undefined ? null : charset;
  }
}
