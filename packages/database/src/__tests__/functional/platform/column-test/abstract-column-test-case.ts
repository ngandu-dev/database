import { describe, expect, it } from "vitest";

import { Connection } from "../../../../connection";
import { ParameterType } from "../../../../parameter-type";
import { AbstractMySQLPlatform } from "../../../../platforms/abstract-mysql-platform";
import { PostgreSQLPlatform } from "../../../../platforms/postgresql-platform";
import { SQLitePlatform } from "../../../../platforms/sqlite-platform";
import { SQLServerPlatform } from "../../../../platforms/sqlserver-platform";
import { Column } from "../../../../schema/column";
import type { ColumnEditor } from "../../../../schema/column-editor";
import { Table } from "../../../../schema/table";
import { Types } from "../../../../types/types";
import { useFunctionalTestCase } from "../../_helpers/functional-test-case";

type SupportedPlatformCtor =
  | typeof AbstractMySQLPlatform
  | typeof PostgreSQLPlatform
  | typeof SQLServerPlatform
  | typeof SQLitePlatform;

type ColumnCaseConfig = {
  doctrineClassName: string;
  platformClass: SupportedPlatformCtor;
  skippedDoctrineTests?: Set<string>;
};

export function registerAbstractColumnTestCase(config: ColumnCaseConfig): void {
  describe(`Functional/Platform/ColumnTest/${config.doctrineClassName}`, () => {
    const functional = useFunctionalTestCase();
    const skipped = config.skippedDoctrineTests ?? new Set<string>();

    const runColumnTest = (
      doctrineTestName: string,
      editorFactory: () => ColumnEditor,
      value: string,
      bindType: ParameterType,
    ) => {
      it(doctrineTestName, async ({ skip }) => {
        if (skipped.has(doctrineTestName)) {
          skip();
        }

        const connection = functional.connection();
        if (!(connection.getDatabasePlatform() instanceof config.platformClass)) {
          skip();
        }

        await assertColumn(functional.connection(), functional, editorFactory(), value, bindType);
      });
    };

    runColumnTest(
      "testVariableLengthStringNoLength",
      () => Column.editor().setTypeName(Types.STRING),
      "Test",
      ParameterType.STRING,
    );

    for (const [label, value] of string8Provider()) {
      runColumnTest(
        `testVariableLengthStringWithLength (${label})`,
        () => Column.editor().setTypeName(Types.STRING).setLength(8),
        value,
        ParameterType.STRING,
      );
    }

    for (const [label, value] of string1Provider()) {
      runColumnTest(
        `testFixedLengthStringNoLength (${label})`,
        () => Column.editor().setTypeName(Types.STRING).setFixed(true),
        value,
        ParameterType.STRING,
      );
    }

    for (const [label, value] of string8Provider()) {
      runColumnTest(
        `testFixedLengthStringWithLength (${label})`,
        () => Column.editor().setTypeName(Types.STRING).setFixed(true).setLength(8),
        value,
        ParameterType.STRING,
      );
    }

    runColumnTest(
      "testVariableLengthBinaryNoLength",
      () => Column.editor().setTypeName(Types.BINARY),
      "\x00\x01\x02\x03",
      ParameterType.BINARY,
    );
    runColumnTest(
      "testVariableLengthBinaryWithLength",
      () => Column.editor().setTypeName(Types.BINARY).setLength(8),
      "\xCE\xC6\x6B\xDD\x9F\xD8\x07\xB4",
      ParameterType.BINARY,
    );
    runColumnTest(
      "testFixedLengthBinaryNoLength",
      () => Column.editor().setTypeName(Types.BINARY).setFixed(true),
      "\xFF",
      ParameterType.BINARY,
    );
    runColumnTest(
      "testFixedLengthBinaryWithLength",
      () => Column.editor().setTypeName(Types.BINARY).setFixed(true).setLength(8),
      "\xA0\x0A\x7B\x0E\xA4\x60\x78\xD8",
      ParameterType.BINARY,
    );
  });
}

function string1Provider(): ReadonlyArray<readonly [string, string]> {
  return [
    ["ansi", "Z"],
    ["unicode", "Я"],
  ] as const;
}

function string8Provider(): ReadonlyArray<readonly [string, string]> {
  return [
    ["ansi", "Doctrine"],
    ["unicode", "Доктрина"],
  ] as const;
}

async function assertColumn(
  connection: Connection,
  functional: ReturnType<typeof useFunctionalTestCase>,
  editor: ColumnEditor,
  value: string,
  bindType: ParameterType,
): Promise<void> {
  const column = editor.setUnquotedName("val").create();
  const table = Table.editor().setUnquotedName("column_test").setColumns(column).create();
  const boundValue = bindType === ParameterType.BINARY ? Buffer.from(value, "latin1") : value;

  await functional.dropAndCreateTable(table);
  expect(await connection.insert("column_test", { val: boundValue }, { val: bindType })).toBe(1);

  const rawValue = await connection.fetchOne("SELECT val FROM column_test");
  const converted = column.getType().convertToNodeValue(rawValue, connection.getDatabasePlatform());

  if (bindType === ParameterType.BINARY) {
    expect(toHexBytes(converted)).toBe(toHexBytes(value));
    return;
  }

  expect(converted).toBe(value);
}

function toHexBytes(value: unknown): string {
  if (typeof value === "string") {
    return Buffer.from(value, "latin1").toString("hex");
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("hex");
  }

  throw new Error(`Expected binary-compatible value, got ${typeof value}`);
}
