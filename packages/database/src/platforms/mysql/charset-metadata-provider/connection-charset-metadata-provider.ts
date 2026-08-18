import type { Connection } from "../../../connection";
import type { CharsetMetadataProvider } from "../charset-metadata-provider";

type MetadataQueryConnection = Pick<Connection, "fetchOne">;

export class ConnectionCharsetMetadataProvider implements CharsetMetadataProvider {
  public constructor(private readonly connection: MetadataQueryConnection) {}

  public async getDefaultCharsetCollation(charset: string): Promise<string | null> {
    const collation = await this.connection.fetchOne<string>(
      `SELECT DEFAULT_COLLATE_NAME
FROM information_schema.CHARACTER_SETS
WHERE CHARACTER_SET_NAME = ?;`,
      [charset],
    );

    return collation === undefined ? null : collation;
  }
}
