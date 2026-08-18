import type { Connection } from "../connection";
import type { AbstractSchemaManager } from "./abstract-schema-manager";

export interface SchemaManagerFactory {
  createSchemaManager(connection: Connection): AbstractSchemaManager;
}
