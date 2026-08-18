import type { Connection } from "../connection";
import type { AbstractSchemaManager } from "./abstract-schema-manager";
import type { SchemaManagerFactory } from "./schema-manager-factory";

/**
 * Default factory: asks the resolved platform for its schema manager implementation.
 */
export class DefaultSchemaManagerFactory implements SchemaManagerFactory {
  public createSchemaManager(connection: Connection): AbstractSchemaManager {
    return connection.getDatabasePlatform().createSchemaManager(connection);
  }
}
