import { beforeEach, describe, expect, it } from "vitest";

import type { Connection } from "../../connection";
import { ParameterBindingStyle } from "../../driver/_internal";
import { ParameterType } from "../../parameter-type";
import { AbstractMySQLPlatform } from "../../platforms/abstract-mysql-platform";
import { Column } from "../../schema/column";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/StatementTest", () => {
  const functional = useFunctionalTestCase();
  let connection: Connection;

  beforeEach(async () => {
    connection = functional.connection();
    await resetStmtTestTable(functional);
  });

  it("reuses a statement after freeing the result", async () => {
    await connection.insert("stmt_test", { id: 1 });
    await connection.insert("stmt_test", { id: 2 });

    const stmt = await connection.prepare("SELECT id FROM stmt_test ORDER BY id");

    let result = await stmt.executeQuery();
    expect(result.fetchOne()).toBe(1);

    result.free();

    result = await stmt.executeQuery();
    expect(result.fetchOne()).toBe(1);
    expect(result.fetchOne()).toBe(2);
  });

  it("reuses a statement when later results contain longer values", async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("stmt_longer_results")
        .setColumns(
          Column.editor().setUnquotedName("param").setTypeName(Types.STRING).setLength(24).create(),
          Column.editor().setUnquotedName("val").setTypeName(Types.TEXT).create(),
        )
        .create(),
    );

    await connection.insert("stmt_longer_results", { param: "param1", val: "X" });

    const stmt = await connection.prepare(
      "SELECT param, val FROM stmt_longer_results ORDER BY param",
    );

    let result = await stmt.executeQuery();
    expect(result.fetchAllNumeric()).toEqual([["param1", "X"]]);

    await connection.insert("stmt_longer_results", {
      param: "param2",
      val: "A bit longer value",
    });

    result = await stmt.executeQuery();
    expect(result.fetchAllNumeric()).toEqual([
      ["param1", "X"],
      ["param2", "A bit longer value"],
    ]);
  });

  it("does not block the connection when a previous result was not fully fetched", async () => {
    await connection.insert("stmt_test", { id: 1 });
    await connection.insert("stmt_test", { id: 2 });

    const stmt = await connection.prepare("SELECT id FROM stmt_test ORDER BY id");

    let result = await stmt.executeQuery();
    result.fetchAssociative();

    result = await stmt.executeQuery();
    result.fetchAssociative();

    expect(await connection.fetchOne("SELECT id FROM stmt_test WHERE id = ?", [1])).toBe(1);
  });

  it("reuses a statement after freeing and rebinding a parameter", async () => {
    await connection.insert("stmt_test", { id: 1 });
    await connection.insert("stmt_test", { id: 2 });

    const stmt = await connection.prepare("SELECT id FROM stmt_test WHERE id = ?");
    stmt.bindValue(1, 1);

    let result = await stmt.executeQuery();
    expect(result.fetchOne()).toBe(1);

    result.free();
    stmt.bindValue(1, 2);

    result = await stmt.executeQuery();
    expect(result.fetchOne()).toBe(2);
  });

  it("reuses a statement with a rebound value", async () => {
    await connection.insert("stmt_test", { id: 1 });
    await connection.insert("stmt_test", { id: 2 });

    const stmt = await connection.prepare("SELECT id FROM stmt_test WHERE id = ?");

    stmt.bindValue(1, 1);
    expect((await stmt.executeQuery()).fetchOne()).toBe(1);

    stmt.bindValue(1, 2);
    expect((await stmt.executeQuery()).fetchOne()).toBe(2);
  });

  it("keeps positional parameter binding order by parameter index", async () => {
    const platform = connection.getDatabasePlatform();
    const query = platform.getDummySelectSQL(
      `${platform.getLengthExpression("?")} AS len1, ${platform.getLengthExpression("?")} AS len2`,
    );

    const stmt = await connection.prepare(query);
    stmt.bindValue(2, "banana");
    stmt.bindValue(1, "apple");

    const row = (await stmt.executeQuery()).fetchNumeric();
    expect((row ?? []).map((value) => Number(value))).toEqual([5, 6]);
  });

  it("fetches a single column result with fetchOne()", async () => {
    const result = await connection.executeQuery(
      connection.getDatabasePlatform().getDummySelectSQL(),
    );

    expect(Number(result.fetchOne())).toBe(1);
  });

  it("executes query via prepared statement", async () => {
    const stmt = await connection.prepare(connection.getDatabasePlatform().getDummySelectSQL());

    expect(Number((await stmt.executeQuery()).fetchOne())).toBe(1);
  });

  it("executes statements and returns affected rows", async () => {
    await connection.insert("stmt_test", { id: 1 });

    let stmt = await connection.prepare("UPDATE stmt_test SET name = ? WHERE id = 1");
    stmt.bindValue(1, "bar");
    expect(await stmt.executeStatement()).toBe(1);

    stmt = await connection.prepare("UPDATE stmt_test SET name = ? WHERE id = ?");
    stmt.bindValue(1, "foo");
    stmt.bindValue(2, 1);
    expect(await stmt.executeStatement()).toBe(1);
  });

  it("binds invalid named parameter", async ({ skip }) => {
    if (!driverSupportsNamedParameters(connection)) {
      skip();
    }

    const platform = connection.getDatabasePlatform();
    const statement = await connection.prepare(platform.getDummySelectSQL(":foo"));

    statement.bindValue("bar", "baz");

    await expect(statement.executeQuery()).rejects.toThrow();
  });

  it("fetches long BLOB values", async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("stmt_long_blob")
        .setColumns(
          Column.editor()
            .setUnquotedName("contents")
            .setTypeName(Types.BLOB)
            .setLength(0xffffffff)
            .create(),
        )
        .create(),
    );

    const contents = Buffer.from("X".repeat(1024 * 1024), "utf8");
    await connection.insert("stmt_long_blob", { contents }, [ParameterType.LARGE_OBJECT]);

    const result = await connection.prepare("SELECT contents FROM stmt_long_blob");
    const raw = (await result.executeQuery()).fetchOne();
    const converted = connection.convertToNodeValue(raw, Types.BLOB);

    expect(asBuffer(converted)).toEqual(contents);
  });

  it("executes with redundant parameters", async ({ skip }) => {
    if (!driverReportsRedundantParameters(connection)) {
      skip();
    }

    const platform = connection.getDatabasePlatform();
    const statement = await connection.prepare(platform.getDummySelectSQL());

    statement.bindValue(1, null);

    await expect(statement.executeQuery()).rejects.toThrow();
  });
});

async function resetStmtTestTable(
  functional: ReturnType<typeof useFunctionalTestCase>,
): Promise<void> {
  await functional.dropAndCreateTable(
    Table.editor()
      .setUnquotedName("stmt_test")
      .setColumns(
        Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
        Column.editor().setUnquotedName("name").setTypeName(Types.TEXT).setNotNull(false).create(),
      )
      .create(),
  );
}

function driverSupportsNamedParameters(connection: Connection): boolean {
  const driver = connection.getDriver() as { bindingStyle?: unknown };
  return driver.bindingStyle === ParameterBindingStyle.NAMED;
}

function driverReportsRedundantParameters(connection: Connection): boolean {
  const driver = connection.getDriver() as { bindingStyle?: unknown };
  if (driver.bindingStyle === ParameterBindingStyle.NAMED) {
    return false;
  }

  return !(connection.getDatabasePlatform() instanceof AbstractMySQLPlatform);
}

function asBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(value));
  }

  if (typeof value === "string") {
    return Buffer.from(value, "utf8");
  }

  throw new Error(`Unsupported blob value: ${String(value)}`);
}
