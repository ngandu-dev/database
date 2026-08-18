import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ArrayParameterType } from "../../array-parameter-type";
import { ParameterType } from "../../parameter-type";
import { Column } from "../../schema/column";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/BinaryDataAccessTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("binary_fetch_table")
        .setColumns(
          Column.editor().setUnquotedName("test_int").setTypeName(Types.INTEGER).create(),
          Column.editor()
            .setUnquotedName("test_binary")
            .setTypeName(Types.BINARY)
            .setNotNull(false)
            .setLength(4)
            .create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("test_int").create(),
        )
        .create(),
    );

    await functional.connection().insert(
      "binary_fetch_table",
      {
        test_int: 1,
        test_binary: Buffer.from("c0def00d", "hex"),
      },
      { test_binary: ParameterType.BINARY },
    );
  });

  afterEach(async () => {
    await functional.dropTableIfExists("binary_fetch_table");
  });

  it("prepare with bindValue", async () => {
    const connection = functional.connection();
    const stmt = await connection.prepare(
      "SELECT test_int, test_binary FROM binary_fetch_table WHERE test_int = ? AND test_binary = ?",
    );

    stmt.bindValue(1, 1);
    stmt.bindValue(2, Buffer.from("c0def00d", "hex"), ParameterType.BINARY);

    const row = lowerCaseKeys((await stmt.executeQuery()).fetchAssociative());
    expect(row).toBeDefined();
    expect(Object.keys(row as Record<string, unknown>)).toEqual(["test_int", "test_binary"]);
    expect((row as Record<string, unknown>).test_int).toBe(1);
    expect(toBinaryBuffer((row as Record<string, unknown>).test_binary)).toEqual(
      Buffer.from("c0def00d", "hex"),
    );
  });

  it("prepare with fetchAllAssociative", async () => {
    const connection = functional.connection();
    const stmt = await connection.prepare(
      "SELECT test_int, test_binary FROM binary_fetch_table WHERE test_int = ? AND test_binary = ?",
    );

    stmt.bindValue(1, 1);
    stmt.bindValue(2, Buffer.from("c0def00d", "hex"), ParameterType.BINARY);

    const rows = (await stmt.executeQuery()).fetchAllAssociative().map(lowerCaseKeys);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toBeDefined();
    expect(Object.keys(rows[0]!)).toEqual(["test_int", "test_binary"]);
    expect(rows[0]!.test_int).toBe(1);
    expect(toBinaryBuffer(rows[0]!.test_binary)).toEqual(Buffer.from("c0def00d", "hex"));
  });

  it("prepare with fetchOne", async () => {
    const connection = functional.connection();
    const stmt = await connection.prepare(
      "SELECT test_int FROM binary_fetch_table WHERE test_int = ? AND test_binary = ?",
    );

    stmt.bindValue(1, 1);
    stmt.bindValue(2, Buffer.from("c0def00d", "hex"), ParameterType.BINARY);

    expect((await stmt.executeQuery()).fetchOne()).toBe(1);
  });

  it("fetchAllAssociative", async () => {
    const rows = await functional
      .connection()
      .fetchAllAssociative(
        "SELECT test_int, test_binary FROM binary_fetch_table WHERE test_int = ? AND test_binary = ?",
        [1, Buffer.from("c0def00d", "hex")],
        { 1: ParameterType.BINARY },
      );

    expect(rows).toHaveLength(1);
    const row = lowerCaseKeys(rows[0]);
    expect(row.test_int).toBe(1);
    expect(toBinaryBuffer(row.test_binary)).toEqual(Buffer.from("c0def00d", "hex"));
  });

  it("fetchAllAssociative with types", async () => {
    const rows = await functional
      .connection()
      .fetchAllAssociative(
        "SELECT test_int, test_binary FROM binary_fetch_table WHERE test_int = ? AND test_binary = ?",
        [1, Buffer.from("c0def00d", "hex")],
        [ParameterType.STRING, Types.BINARY],
      );

    expect(rows).toHaveLength(1);
    const row = lowerCaseKeys(rows[0]);
    expect(row.test_int).toBe(1);
    expect(toBinaryBuffer(row.test_binary)).toEqual(Buffer.from("c0def00d", "hex"));
  });

  it("fetchAssociative", async () => {
    const row = await functional
      .connection()
      .fetchAssociative(
        "SELECT test_int, test_binary FROM binary_fetch_table WHERE test_int = ? AND test_binary = ?",
        [1, Buffer.from("c0def00d", "hex")],
        { 1: ParameterType.BINARY },
      );

    expect(row).toBeDefined();
    const normalized = lowerCaseKeys(row);
    expect(normalized.test_int).toBe(1);
    expect(toBinaryBuffer(normalized.test_binary)).toEqual(Buffer.from("c0def00d", "hex"));
  });

  it("fetchAssociative with types", async () => {
    const row = await functional
      .connection()
      .fetchAssociative(
        "SELECT test_int, test_binary FROM binary_fetch_table WHERE test_int = ? AND test_binary = ?",
        [1, Buffer.from("c0def00d", "hex")],
        [ParameterType.STRING, Types.BINARY],
      );

    expect(row).toBeDefined();
    const normalized = lowerCaseKeys(row);
    expect(normalized.test_int).toBe(1);
    expect(toBinaryBuffer(normalized.test_binary)).toEqual(Buffer.from("c0def00d", "hex"));
  });

  it("fetchNumeric", async () => {
    const row = await functional
      .connection()
      .fetchNumeric(
        "SELECT test_int, test_binary FROM binary_fetch_table WHERE test_int = ? AND test_binary = ?",
        [1, Buffer.from("c0def00d", "hex")],
        { 1: ParameterType.BINARY },
      );

    expect(row).toBeDefined();
    expect(row?.[0]).toBe(1);
    expect(toBinaryBuffer(row?.[1])).toEqual(Buffer.from("c0def00d", "hex"));
  });

  it("fetchNumeric with types", async () => {
    const row = await functional
      .connection()
      .fetchNumeric(
        "SELECT test_int, test_binary FROM binary_fetch_table WHERE test_int = ? AND test_binary = ?",
        [1, Buffer.from("c0def00d", "hex")],
        [ParameterType.STRING, Types.BINARY],
      );

    expect(row).toBeDefined();
    expect(row?.[0]).toBe(1);
    expect(toBinaryBuffer(row?.[1])).toEqual(Buffer.from("c0def00d", "hex"));
  });

  it("fetchOne", async () => {
    const connection = functional.connection();
    expect(
      await connection.fetchOne(
        "SELECT test_int FROM binary_fetch_table WHERE test_int = ? AND test_binary = ?",
        [1, Buffer.from("c0def00d", "hex")],
        { 1: ParameterType.BINARY },
      ),
    ).toBe(1);

    const binary = await connection.fetchOne(
      "SELECT test_binary FROM binary_fetch_table WHERE test_int = ? AND test_binary = ?",
      [1, Buffer.from("c0def00d", "hex")],
      { 1: ParameterType.BINARY },
    );
    expect(toBinaryBuffer(binary)).toEqual(Buffer.from("c0def00d", "hex"));
  });

  it("fetchOne with types", async () => {
    const binary = await functional
      .connection()
      .fetchOne(
        "SELECT test_binary FROM binary_fetch_table WHERE test_int = ? AND test_binary = ?",
        [1, Buffer.from("c0def00d", "hex")],
        [ParameterType.STRING, Types.BINARY],
      );

    expect(toBinaryBuffer(binary)).toEqual(Buffer.from("c0def00d", "hex"));
  });

  it("native array list support", async () => {
    const connection = functional.connection();
    const binaryValues = [
      "a0aefa",
      "1f43ba",
      "8c9d2a",
      "72e8aa",
      "5b6f9a",
      "dab24a",
      "3e71ca",
      "f0d6ea",
      "6a8b5a",
      "c582fa",
    ].map((hex) => Buffer.from(hex, "hex"));

    for (let value = 100; value < 110; value += 1) {
      await connection.insert(
        "binary_fetch_table",
        { test_int: value, test_binary: binaryValues[value - 100] },
        { test_binary: ParameterType.BINARY },
      );
    }

    let result = await connection.executeQuery(
      "SELECT test_int FROM binary_fetch_table WHERE test_int IN (?) ORDER BY test_int",
      [[100, 101, 102, 103, 104]],
      [ArrayParameterType.INTEGER],
    );
    expect(result.fetchAllNumeric()).toEqual([[100], [101], [102], [103], [104]]);

    result = await connection.executeQuery(
      "SELECT test_int FROM binary_fetch_table WHERE test_binary IN (?) ORDER BY test_int",
      [[binaryValues[0], binaryValues[1], binaryValues[2], binaryValues[3], binaryValues[4]]],
      [ArrayParameterType.BINARY],
    );
    expect(result.fetchAllNumeric()).toEqual([[100], [101], [102], [103], [104]]);

    result = await connection.executeQuery(
      "SELECT test_binary FROM binary_fetch_table WHERE test_binary IN (?) ORDER BY test_int",
      [[binaryValues[0], binaryValues[1], binaryValues[2], binaryValues[3], binaryValues[4]]],
      [ArrayParameterType.BINARY],
    );
    expect(result.fetchFirstColumn().map(toBinaryBuffer)).toEqual(binaryValues.slice(0, 5));
  });
});

function lowerCaseKeys(row: Record<string, unknown> | undefined): Record<string, unknown> {
  if (row === undefined) {
    throw new Error("Expected a row.");
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key.toLowerCase()] = value;
  }

  return normalized;
}

function toBinaryBuffer(value: unknown): Buffer {
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
    return Buffer.from(value, "binary");
  }

  throw new Error(`Unsupported binary value: ${String(value)}`);
}
