import { beforeEach, describe, expect, it } from "vitest";

import type { Connection } from "../../connection";
import { DriverException } from "../../exception/driver-exception";
import { ParameterType } from "../../parameter-type";
import { Column } from "../../schema/column";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { registerBuiltInTypes } from "../../types/register-built-in-types";
import { Type } from "../../types/type";
import { Types } from "../../types/types";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/WriteTest", () => {
  const functional = useFunctionalTestCase();
  let connection: Connection;

  beforeEach(async () => {
    registerBuiltInTypes();
    connection = functional.connection();
    await resetWriteTable(functional);
  });

  it("executeStatement() returns affected rows", async () => {
    const affected = await connection.executeStatement(
      "INSERT INTO write_table (test_int) VALUES (1)",
    );

    expect(affected).toBe(1);
  });

  it("executeStatement() supports explicit parameter types", async () => {
    const affected = await connection.executeStatement(
      "INSERT INTO write_table (test_int, test_string) VALUES (?, ?)",
      [1, "foo"],
      [ParameterType.INTEGER, ParameterType.STRING],
    );

    expect(affected).toBe(1);
  });

  it("prepared executeStatement() rowCount returns affected rows", async () => {
    const stmt = await connection.prepare(
      "INSERT INTO write_table (test_int, test_string) VALUES (?, ?)",
    );
    stmt.bindValue(1, 1);
    stmt.bindValue(2, "foo");

    expect(await stmt.executeStatement()).toBe(1);
  });

  it("binds primitive parameter types", async () => {
    const stmt = await connection.prepare(
      "INSERT INTO write_table (test_int, test_string) VALUES (?, ?)",
    );
    stmt.bindValue(1, 1, ParameterType.INTEGER);
    stmt.bindValue(2, "foo", ParameterType.STRING);

    expect(await stmt.executeStatement()).toBe(1);
  });

  it("binds Datazen type instances", async () => {
    const stmt = await connection.prepare(
      "INSERT INTO write_table (test_int, test_string) VALUES (?, ?)",
    );
    stmt.bindValue(1, 1, Type.getType(Types.INTEGER));
    stmt.bindValue(2, "foo", Type.getType(Types.STRING));

    expect(await stmt.executeStatement()).toBe(1);
  });

  it("binds Datazen type names", async () => {
    const stmt = await connection.prepare(
      "INSERT INTO write_table (test_int, test_string) VALUES (?, ?)",
    );
    stmt.bindValue(1, 1, Types.INTEGER);
    stmt.bindValue(2, "foo", Types.STRING);

    expect(await stmt.executeStatement()).toBe(1);
  });

  it("supports insert()", async () => {
    await insertRows(connection);
  });

  it("supports delete() with criteria", async () => {
    await insertRows(connection);

    expect(await connection.delete("write_table", { test_int: 2 })).toBe(1);
    expect((await connection.fetchAllAssociative("SELECT * FROM write_table")).length).toBe(1);

    expect(await connection.delete("write_table", { test_int: 1 })).toBe(1);
    expect((await connection.fetchAllAssociative("SELECT * FROM write_table")).length).toBe(0);
  });

  it("supports delete() without criteria", async () => {
    await insertRows(connection);

    expect(await connection.delete("write_table")).toBe(2);
    expect((await connection.fetchAllAssociative("SELECT * FROM write_table")).length).toBe(0);
  });

  it("supports update() with criteria", async () => {
    await insertRows(connection);

    expect(
      await connection.update("write_table", { test_string: "bar" }, { test_string: "foo" }),
    ).toBe(1);

    expect(
      await connection.update("write_table", { test_string: "baz" }, { test_string: "bar" }),
    ).toBe(2);

    expect(
      await connection.update("write_table", { test_string: "baz" }, { test_string: "bar" }),
    ).toBe(0);
  });

  it("supports update() without criteria", async () => {
    await insertRows(connection);

    expect(await connection.update("write_table", { test_string: "baz" })).toBe(2);
  });

  it("returns lastInsertId() on identity platforms", async () => {
    const target = functional.getTarget();
    if (target.driver === "pg" || target.driver === "mssql") {
      return;
    }

    expect(connection.getDatabasePlatform().supportsIdentityColumns()).toBe(true);

    expect(await connection.insert("write_table", { test_int: 2, test_string: "bar" })).toBe(1);
    const id = await connection.lastInsertId();

    expect(Number(id)).toBeGreaterThan(0);
  });

  it("throws on lastInsertId() for a fresh connection (Node-adapted Doctrine intent)", async () => {
    const freshConnection = await functional.createConnection();

    await expect(freshConnection.lastInsertId()).rejects.toThrow(DriverException);
    await freshConnection.close();
  });

  it("supports insert() with key/value type maps", async () => {
    const value = new Date("2013-04-14T10:10:10");
    const platform = connection.getDatabasePlatform();

    await connection.insert(
      "write_table",
      { test_int: "30", test_string: value },
      { test_int: Types.INTEGER, test_string: Types.DATETIME_MUTABLE },
    );

    const stored = await connection.fetchOne<string>(
      "SELECT test_string FROM write_table WHERE test_int = 30",
    );

    expect(stored).toBe(
      Type.getType(Types.DATETIME_MUTABLE).convertToDatabaseValue(value, platform),
    );
  });

  it("supports update() with key/value type maps", async () => {
    const first = new Date("2013-04-14T10:10:10");
    const second = new Date("2013-04-15T10:10:10");
    const platform = connection.getDatabasePlatform();

    await connection.insert(
      "write_table",
      { test_int: "30", test_string: first },
      { test_int: Types.INTEGER, test_string: Types.DATETIME_MUTABLE },
    );

    await connection.update(
      "write_table",
      { test_string: second },
      { test_int: "30" },
      { test_int: Types.INTEGER, test_string: Types.DATETIME_MUTABLE },
    );

    const stored = await connection.fetchOne<string>(
      "SELECT test_string FROM write_table WHERE test_int = 30",
    );

    expect(stored).toBe(
      Type.getType(Types.DATETIME_MUTABLE).convertToDatabaseValue(second, platform),
    );
  });

  it("supports delete() with key/value type maps", async () => {
    const value = new Date("2013-04-14T10:10:10");

    await connection.insert(
      "write_table",
      { test_int: "30", test_string: value },
      { test_int: Types.INTEGER, test_string: Types.DATETIME_MUTABLE },
    );

    await connection.delete(
      "write_table",
      { test_int: 30, test_string: value },
      { test_int: Types.INTEGER, test_string: Types.DATETIME_MUTABLE },
    );

    expect(
      await connection.fetchOne("SELECT test_string FROM write_table WHERE test_int = 30"),
    ).toBeUndefined();
  });

  it("supports empty identity insert SQL", async () => {
    const target = functional.getTarget();
    if (target.driver === "pg" || target.driver === "mssql") {
      return;
    }

    const platform = connection.getDatabasePlatform();
    expect(platform.supportsIdentityColumns()).toBe(true);

    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("test_empty_identity")
        .setColumns(
          Column.editor()
            .setUnquotedName("id")
            .setTypeName(Types.INTEGER)
            .setAutoincrement(true)
            .create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        )
        .create(),
    );

    const sql = platform.getEmptyIdentityInsertSQL("test_empty_identity", "id");

    await connection.executeStatement(sql);
    const firstId = Number(await connection.lastInsertId());

    await connection.executeStatement(sql);
    const secondId = Number(await connection.lastInsertId());

    expect(secondId).toBeGreaterThan(firstId);
  });

  it("supports update() criteria with IS NULL", async () => {
    await connection.insert(
      "write_table",
      { test_int: "30", test_string: null },
      { test_int: Types.INTEGER, test_string: Types.STRING },
    );

    expect(
      (await connection.fetchAllAssociative("SELECT * FROM write_table WHERE test_int = 30"))
        .length,
    ).toBe(1);

    await connection.update(
      "write_table",
      { test_int: 10 },
      { test_string: null },
      { test_int: Types.INTEGER, test_string: Types.STRING },
    );

    expect(
      (await connection.fetchAllAssociative("SELECT * FROM write_table WHERE test_int = 30"))
        .length,
    ).toBe(0);
  });

  it("supports delete() criteria with IS NULL", async () => {
    await connection.insert(
      "write_table",
      { test_int: "30", test_string: null },
      { test_int: Types.INTEGER, test_string: Types.STRING },
    );

    expect(
      (await connection.fetchAllAssociative("SELECT * FROM write_table WHERE test_int = 30"))
        .length,
    ).toBe(1);

    await connection.delete("write_table", { test_string: null }, { test_string: Types.STRING });

    expect(
      (await connection.fetchAllAssociative("SELECT * FROM write_table WHERE test_int = 30"))
        .length,
    ).toBe(0);
  });
});

async function resetWriteTable(
  functional: ReturnType<typeof useFunctionalTestCase>,
): Promise<void> {
  await functional.dropAndCreateTable(
    Table.editor()
      .setUnquotedName("write_table")
      .setColumns(
        Column.editor()
          .setUnquotedName("id")
          .setTypeName(Types.INTEGER)
          .setAutoincrement(true)
          .create(),
        Column.editor().setUnquotedName("test_int").setTypeName(Types.INTEGER).create(),
        Column.editor()
          .setUnquotedName("test_string")
          .setTypeName(Types.STRING)
          .setLength(32)
          .setNotNull(false)
          .create(),
      )
      .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create())
      .create(),
  );
}

async function insertRows(connection: Connection): Promise<void> {
  expect(await connection.insert("write_table", { test_int: 1, test_string: "foo" })).toBe(1);
  expect(await connection.insert("write_table", { test_int: 2, test_string: "bar" })).toBe(1);
}
