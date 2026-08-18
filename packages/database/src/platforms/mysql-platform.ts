import type { Connection } from "../connection";
import { AbstractMySQLPlatform } from "./abstract-mysql-platform";
import { MySQLMetadataProvider } from "./mysql/mysql-metadata-provider";

export class MySQLPlatform extends AbstractMySQLPlatform {
  public override createMetadataProvider(connection: Connection): MySQLMetadataProvider {
    return new MySQLMetadataProvider(connection, this, connection.getDatabase() ?? "");
  }
}
