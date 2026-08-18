import { describe, expect, it } from "vitest";

import { AbstractMySQLPlatform } from "../../../platforms/abstract-mysql-platform";
import { SQLitePlatform } from "../../../platforms/sqlite-platform";
import { Column } from "../../../schema/column";
import { PrimaryKeyConstraint } from "../../../schema/primary-key-constraint";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Types/BigIntTypeTest", () => {
  const functional = useFunctionalTestCase();

  it.each([
    ["zero", "0", 0],
    ["null", "null", null],
    ["positive number", "42", 42],
    ["negative number", "-42", -42],
    ["largest safe positive", String(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER],
    ["largest safe negative", String(Number.MIN_SAFE_INTEGER), Number.MIN_SAFE_INTEGER],
    ["unsafe positive", "9007199254740993", 9007199254740993n],
    ["unsafe negative", "-9007199254740993", -9007199254740993n],
  ] as const)("select bigint (%s)", async (_label, sqlLiteral, expectedValue) => {
    const connection = functional.connection();

    if (
      connection.getDatabasePlatform() instanceof SQLitePlatform &&
      typeof expectedValue === "bigint"
    ) {
      // Node sqlite3 surfaces 64-bit integer values as JS numbers and loses precision
      // beyond Number.MAX_SAFE_INTEGER.
      return;
    }

    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("bigint_type_test")
        .setColumns(
          Column.editor().setUnquotedName("id").setTypeName(Types.SMALLINT).create(),
          Column.editor()
            .setUnquotedName("my_integer")
            .setTypeName(Types.BIGINT)
            .setNotNull(false)
            .create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        )
        .create(),
    );

    await connection.executeStatement(
      `INSERT INTO bigint_type_test (id, my_integer) VALUES (42, ${sqlLiteral})`,
    );

    expect(
      connection.convertToNodeValue(
        await connection.fetchOne("SELECT my_integer FROM bigint_type_test WHERE id = 42"),
        Types.BIGINT,
      ),
    ).toBe(expectedValue);
  });

  it("unsigned bigint on mysql/mariadb", async ({ skip }) => {
    const connection = functional.connection();

    if (!(connection.getDatabasePlatform() instanceof AbstractMySQLPlatform)) {
      skip();
    }

    await functional.dropAndCreateTable(
      Table.editor()
        .setUnquotedName("bigint_type_test")
        .setColumns(
          Column.editor().setUnquotedName("id").setTypeName(Types.SMALLINT).create(),
          Column.editor()
            .setUnquotedName("my_integer")
            .setTypeName(Types.BIGINT)
            .setNotNull(false)
            .setUnsigned(true)
            .create(),
        )
        .setPrimaryKeyConstraint(
          PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create(),
        )
        .create(),
    );

    await connection.executeStatement(
      "INSERT INTO bigint_type_test (id, my_integer) VALUES (42, 0xFFFFFFFFFFFFFFFF)",
    );

    expect(
      connection.convertToNodeValue(
        await connection.fetchOne("SELECT my_integer FROM bigint_type_test WHERE id = 42"),
        Types.BIGINT,
      ),
    ).toBe(18446744073709551615n);
  });
});
