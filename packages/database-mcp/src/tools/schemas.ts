import { z } from "zod";

import { MAX_ROWS_LIMIT } from "../constants";

const jsonRecordSchema = z.record(z.string(), z.json());
const unsupportedSchema = z.object({ supported: z.literal(false) });

export const emptyInputSchema = z.object({});

export const schemaFilterInputSchema = z.object({
  schema: z.string().min(1).optional().describe("Optional schema name filter."),
});

export const describeTableInputSchema = z.object({
  table: z.string().min(1).describe("Table name, optionally schema-qualified."),
  schema: z.string().min(1).optional().describe("Optional schema name."),
});

export const executeQueryInputSchema = z.object({
  sql: z.string().min(1).describe("SQL sent unchanged to the configured database account."),
  parameters: z
    .union([z.array(z.unknown()), z.record(z.string(), z.unknown())])
    .optional()
    .describe("Positional array or named object."),
  max_rows: z
    .number()
    .int()
    .min(1)
    .max(MAX_ROWS_LIMIT)
    .optional()
    .describe(`Maximum returned rows, capped at ${MAX_ROWS_LIMIT}.`),
});

export const databaseInfoOutputSchema = z.object({
  driver: z.enum(["pg", "mysql2", "mssql", "sqlite3"]),
  database: z.string().nullable(),
  server_version: z.string(),
  capabilities: z.object({
    list_databases: z.boolean(),
    list_schemas: z.boolean(),
    list_tables: z.boolean(),
    list_views: z.boolean(),
    describe_table: z.boolean(),
    execute_query: z.boolean(),
  }),
  result_limits: z.object({
    default_max_rows: z.number().int(),
    maximum_max_rows: z.number().int(),
  }),
});

export const listDatabasesOutputSchema = z.union([
  unsupportedSchema,
  z.object({ supported: z.literal(true), databases: z.array(z.string()) }),
]);

export const listSchemasOutputSchema = z.union([
  unsupportedSchema,
  z.object({ supported: z.literal(true), schemas: z.array(z.string()) }),
]);

export function listNamesOutputSchema(name: "tables" | "views") {
  return z.object({ [name]: z.array(z.string()), count: z.number().int().nonnegative() });
}

export const describeTableOutputSchema = z.object({
  table: z.string(),
  comment: z.string().nullable(),
  columns: z.array(jsonRecordSchema),
  primary_key: z.array(z.string()),
  indexes: z.array(jsonRecordSchema),
  foreign_keys: z.array(jsonRecordSchema),
  options: jsonRecordSchema,
});

export const executeQueryOutputSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.json())),
  row_count: z.union([z.number(), z.string()]),
  returned_row_count: z.number().int().nonnegative(),
  truncated: z.boolean(),
  duration_ms: z.number().nonnegative(),
});
