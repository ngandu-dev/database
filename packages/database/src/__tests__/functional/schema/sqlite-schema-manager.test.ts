import { describe, expect, it } from "vitest";

import { SQLitePlatform } from "../../../platforms/sqlite-platform";
import { OptionallyQualifiedName } from "../../../schema/name/optionally-qualified-name";
import { Type } from "../../../types/type";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Schema/SQLiteSchemaManagerTest", () => {
  const functional = useFunctionalTestCase();

  it("introspect database names", async ({ skip }) => {
    if (!(functional.connection().getDatabasePlatform() instanceof SQLitePlatform)) {
      skip();
    }

    await expect(
      (await functional.connection().createSchemaManager()).introspectDatabaseNames(),
    ).rejects.toThrow();
  });

  it("list table columns with whitespaces in type declarations", async ({ skip }) => {
    const connection = functional.connection();
    if (!(connection.getDatabasePlatform() instanceof SQLitePlatform)) {
      skip();
    }

    await functional.dropTableIfExists("dbal_1779");
    await connection.executeStatement(`CREATE TABLE dbal_1779 (
      foo VARCHAR (64),
      bar TEXT (100)
    )`);

    const columns = await (
      await connection.createSchemaManager()
    ).introspectTableColumnsByUnquotedName("dbal_1779");

    expect(columns).toHaveLength(2);
    expect(columns[0]?.getType()).toBe(Type.getType(Types.STRING));
    expect(columns[1]?.getType()).toBe(Type.getType(Types.TEXT));
    expect(columns[0]?.getLength()).toBe(64);
    expect(columns[1]?.getLength()).toBe(100);
  });

  it("list table columns with mixed case in type declarations", async ({ skip }) => {
    const connection = functional.connection();
    if (!(connection.getDatabasePlatform() instanceof SQLitePlatform)) {
      skip();
    }

    await functional.dropTableIfExists("dbal_mixed");
    await connection.executeStatement(`CREATE TABLE dbal_mixed (
      foo VarChar (64),
      bar Text (100)
    )`);

    const columns = await (
      await connection.createSchemaManager()
    ).introspectTableColumnsByUnquotedName("dbal_mixed");

    expect(columns).toHaveLength(2);
    expect(columns[0]?.getType()).toBe(Type.getType(Types.STRING));
    expect(columns[1]?.getType()).toBe(Type.getType(Types.TEXT));
  });

  it("primary key auto increment", async ({ skip }) => {
    const connection = functional.connection();
    if (!(connection.getDatabasePlatform() instanceof SQLitePlatform)) {
      skip();
    }

    await functional.dropTableIfExists("test_pk_auto_increment");
    await connection.executeStatement(`CREATE TABLE test_pk_auto_increment (
      id INTEGER PRIMARY KEY,
      text TEXT
    )`);

    await connection.insert("test_pk_auto_increment", { text: "1" });
    await connection.executeStatement("DELETE FROM test_pk_auto_increment");
    await connection.insert("test_pk_auto_increment", { text: "2" });

    const lastUsedIdAfterDelete = Number(
      await connection.fetchOne('SELECT id FROM test_pk_auto_increment WHERE text = "2"'),
    );
    expect(lastUsedIdAfterDelete).toBe(1);
  });

  it("no whitespace in foreign key reference", async ({ skip }) => {
    const connection = functional.connection();
    if (!(connection.getDatabasePlatform() instanceof SQLitePlatform)) {
      skip();
    }

    await functional.dropTableIfExists("notes");
    await functional.dropTableIfExists("users");

    await connection.executeStatement(`CREATE TABLE "users" ("id" INTEGER)`);
    await connection.executeStatement(`CREATE TABLE "notes" (
      "id" INTEGER,
      "created_by" INTEGER,
      FOREIGN KEY("created_by") REFERENCES "users"("id")
    )`);

    const notes = await (await connection.createSchemaManager()).introspectTableByUnquotedName(
      "notes",
    );
    const foreignKeys = notes.getForeignKeys();
    expect(foreignKeys).toHaveLength(1);

    const foreignKey = foreignKeys[0];
    expect(foreignKey).toBeDefined();
    if (foreignKey === undefined) {
      return;
    }

    expect(foreignKey.getLocalColumns()).toEqual(["created_by"]);
    functional.assertOptionallyQualifiedNameEquals(
      OptionallyQualifiedName.unquoted("users"),
      foreignKey.getReferencedTableName(),
    );
    expect(foreignKey.getForeignColumns()).toEqual(["id"]);
  });
});
