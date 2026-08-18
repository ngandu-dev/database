import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ParameterType } from "../../parameter-type";
import { Column } from "../../schema/column";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";
import { Table } from "../../schema/table";
import { Types } from "../../types/types";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/BlobTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("blob_table")
        .setColumns(
          Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
          Column.editor()
            .setUnquotedName("clobcolumn")
            .setTypeName(Types.TEXT)
            .setNotNull(false)
            .create(),
          Column.editor()
            .setUnquotedName("blobcolumn")
            .setTypeName(Types.BLOB)
            .setNotNull(false)
            .create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        )
        .create(),
    );
  });

  afterEach(async () => {
    await functional.dropTableIfExists("blob_table");
  });

  it("insert", async () => {
    const ret = await functional.connection().insert(
      "blob_table",
      {
        id: 1,
        clobcolumn: "test",
        blobcolumn: "test",
      },
      [ParameterType.INTEGER, ParameterType.STRING, ParameterType.LARGE_OBJECT],
    );

    expect(ret).toBe(1);
  });

  it("insert null", async () => {
    const ret = await functional.connection().insert(
      "blob_table",
      {
        id: 1,
        clobcolumn: null,
        blobcolumn: null,
      },
      [ParameterType.INTEGER, ParameterType.STRING, ParameterType.LARGE_OBJECT],
    );

    expect(ret).toBe(1);

    const row = await fetchRow(functional);
    expect(row).toHaveLength(2);
    expect(row[0]).toBeNull();
    expect(row[1]).toBeNull();
  });

  it.skip("insert processes stream resources (PHP-specific)", async () => {
    // Doctrine validates PHP stream resource processing for LARGE_OBJECT parameters.
    // Datazen uses Node values (Buffer/Uint8Array/string), not PHP resources.
  });

  it("select", async () => {
    await functional
      .connection()
      .insert("blob_table", { id: 1, clobcolumn: "test", blobcolumn: "test" }, [
        ParameterType.INTEGER,
        ParameterType.STRING,
        ParameterType.LARGE_OBJECT,
      ]);

    await assertBlobContains(functional, "test");
  });

  it("update", async () => {
    const connection = functional.connection();
    await connection.insert("blob_table", { id: 1, clobcolumn: "test", blobcolumn: "test" }, [
      ParameterType.INTEGER,
      ParameterType.STRING,
      ParameterType.LARGE_OBJECT,
    ]);

    await connection.update("blob_table", { blobcolumn: "test2" }, { id: 1 }, [
      ParameterType.LARGE_OBJECT,
      ParameterType.INTEGER,
    ]);

    await assertBlobContains(functional, "test2");
  });

  it.skip("update processes stream resources (PHP-specific)", async () => {
    // Doctrine validates PHP stream resource updates for LARGE_OBJECT parameters.
    // Datazen uses Node values (Buffer/Uint8Array/string), not PHP resources.
  });

  it.skip("bindValue processes stream resources (PHP-specific)", async () => {
    // Doctrine validates PHP stream resource bindValue() for LARGE_OBJECT parameters.
    // Datazen uses Node values (Buffer/Uint8Array/string), not PHP resources.
  });

  it("blob binding does not overwrite previous values", async () => {
    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("blob_table")
        .setColumns(
          Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create(),
          Column.editor()
            .setUnquotedName("blobcolumn1")
            .setTypeName(Types.BLOB)
            .setNotNull(false)
            .create(),
          Column.editor()
            .setUnquotedName("blobcolumn2")
            .setTypeName(Types.BLOB)
            .setNotNull(false)
            .create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        )
        .create(),
    );

    await functional
      .connection()
      .executeStatement(
        "INSERT INTO blob_table(id, blobcolumn1, blobcolumn2) VALUES (1, ?, ?)",
        ["test1", "test2"],
        [ParameterType.LARGE_OBJECT, ParameterType.LARGE_OBJECT],
      );

    const blobs = await functional
      .connection()
      .fetchNumeric("SELECT blobcolumn1, blobcolumn2 FROM blob_table");
    expect(blobs).toBeDefined();

    const actual = (blobs ?? []).map((blob) => toText(blob));
    expect(actual).toEqual(["test1", "test2"]);
  });
});

async function assertBlobContains(
  functional: ReturnType<typeof useFunctionalTestCase>,
  text: string,
): Promise<void> {
  const [, blobValue] = await fetchRow(functional);
  expect(toText(blobValue)).toBe(text);
}

async function fetchRow(
  functional: ReturnType<typeof useFunctionalTestCase>,
): Promise<[unknown, unknown]> {
  const rows = await functional
    .connection()
    .fetchAllNumeric("SELECT clobcolumn, blobcolumn FROM blob_table");
  expect(rows).toHaveLength(1);
  return rows[0] as [unknown, unknown];
}

function toText(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("utf8");
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(value)).toString("utf8");
  }

  throw new Error(`Unsupported blob value: ${String(value)}`);
}
