import { beforeEach, describe, expect, it } from "vitest";

import { ParameterType } from "../../../parameter-type";
import { DB2Platform } from "../../../platforms/db2-platform";
import { NotSupported } from "../../../platforms/exception/not-supported";
import { MariaDBPlatform } from "../../../platforms/mariadb-platform";
import { MariaDB1060Platform } from "../../../platforms/mariadb1060-platform";
import { MySQLPlatform } from "../../../platforms/mysql-platform";
import { MySQL80Platform } from "../../../platforms/mysql80-platform";
import { OraclePlatform } from "../../../platforms/oracle-platform";
import { SQLitePlatform } from "../../../platforms/sqlite-platform";
import { ConflictResolutionMode } from "../../../query/for-update/conflict-resolution-mode";
import { UnionType } from "../../../query/union-type";
import { Column } from "../../../schema/column";
import { PrimaryKeyConstraint } from "../../../schema/primary-key-constraint";
import { Table } from "../../../schema/table";
import { Types } from "../../../types/types";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Query/QueryBuilderTest", () => {
  const functional = useFunctionalTestCase();

  beforeEach(async () => {
    const table = Table.editor()
      .setUnquotedName("for_update")
      .setColumns(Column.editor().setUnquotedName("id").setTypeName(Types.INTEGER).create())
      .setPrimaryKeyConstraint(PrimaryKeyConstraint.editor().setUnquotedColumnNames("id").create())
      .create();

    await functional.dropAndCreateTable(table);
    await functional.connection().insert("for_update", { id: 1 });
    await functional.connection().insert("for_update", { id: 2 });
  });

  it("for update ordinary", async ({ skip }) => {
    const connection = functional.connection();
    if (connection.getDatabasePlatform() instanceof SQLitePlatform) {
      skip();
    }

    const qb = connection.createQueryBuilder();
    qb.select("id").from("for_update").forUpdate();

    expect(await qb.fetchFirstColumn()).toEqual([1, 2]);
  });

  it("for update skip locked when supported", async ({ skip }) => {
    const connection = functional.connection();
    if (!platformSupportsSkipLocked(connection.getDatabasePlatform())) {
      skip();
    }

    const qb1 = connection.createQueryBuilder();
    qb1.select("id").from("for_update").where("id = 1").forUpdate();

    await connection.beginTransaction();
    expect(await qb1.fetchFirstColumn()).toEqual([1]);

    const connection2 = await functional.createConnection();

    try {
      const qb2 = connection2.createQueryBuilder();
      qb2
        .select("id")
        .from("for_update")
        .orderBy("id")
        .forUpdate(ConflictResolutionMode.SKIP_LOCKED);

      expect(await qb2.fetchFirstColumn()).toEqual([2]);
    } finally {
      await connection2.close();
      if (connection.isTransactionActive()) {
        await connection.rollBack();
      }
    }
  });

  it("for update skip locked when not supported", async ({ skip }) => {
    const connection = functional.connection();
    if (platformSupportsSkipLocked(connection.getDatabasePlatform())) {
      skip();
    }

    const qb = connection.createQueryBuilder();
    qb.select("id").from("for_update").forUpdate(ConflictResolutionMode.SKIP_LOCKED);

    await expect(qb.executeQuery()).rejects.toThrow();
  });

  it("union all and distinct return expected results", async () => {
    const connection = functional.connection();
    const platform = connection.getDatabasePlatform();

    const qbAll = connection.createQueryBuilder();
    qbAll
      .union(platform.getDummySelectSQL("2 as field_one"))
      .addUnion(platform.getDummySelectSQL("1 as field_one"), UnionType.ALL)
      .addUnion(platform.getDummySelectSQL("1 as field_one"), UnionType.ALL)
      .orderBy("field_one", "ASC");

    const qbDistinct = connection.createQueryBuilder();
    qbDistinct
      .union(platform.getDummySelectSQL("2 as field_one"))
      .addUnion(platform.getDummySelectSQL("1 as field_one"), UnionType.DISTINCT)
      .addUnion(platform.getDummySelectSQL("1 as field_one"), UnionType.DISTINCT)
      .orderBy("field_one", "ASC");

    const allRows = normalizeNumericRows(
      await qbAll.executeQuery().then((result) => result.fetchAllAssociative()),
    );
    const distinctRows = normalizeNumericRows(
      await qbDistinct.executeQuery().then((result) => result.fetchAllAssociative()),
    );

    expect(allRows).toEqual([{ field_one: 1 }, { field_one: 1 }, { field_one: 2 }]);
    expect(distinctRows).toEqual([{ field_one: 1 }, { field_one: 2 }]);
  });

  it("union and addUnion work with query builder parts and named parameters", async () => {
    const connection = functional.connection();
    const qb = connection.createQueryBuilder();

    const sub1 = qb
      .sub()
      .select("id")
      .from("for_update")
      .where(qb.expr().eq("id", qb.createNamedParameter(1, ParameterType.INTEGER)));
    const sub2 = qb
      .sub()
      .select("id")
      .from("for_update")
      .where(qb.expr().eq("id", qb.createNamedParameter(2, ParameterType.INTEGER)));
    const sub3 = qb
      .sub()
      .select("id")
      .from("for_update")
      .where(qb.expr().eq("id", qb.createNamedParameter(1, ParameterType.INTEGER)));

    qb.union(sub1)
      .addUnion(sub2, UnionType.DISTINCT)
      .addUnion(sub3, UnionType.DISTINCT)
      .orderBy("id", "DESC");

    const rows = normalizeNumericRows(
      await qb.executeQuery().then((result) => result.fetchAllAssociative()),
    );

    expect(rows).toEqual([{ id: 2 }, { id: 1 }]);
  });

  it("select with CTE named parameter", async ({ skip }) => {
    const connection = functional.connection();
    const platform = connection.getDatabasePlatform();
    if (!platformSupportsCTEs(platform) || !platformSupportsCTEColumnsDefinition(platform)) {
      skip();
    }

    const qb = connection.createQueryBuilder();
    const cteQueryBuilder = qb
      .sub()
      .select("id AS virtual_id")
      .from("for_update")
      .where("id = :id");

    qb.with("cte_a", cteQueryBuilder, ["virtual_id"])
      .select("virtual_id")
      .from("cte_a")
      .setParameter("id", 1);

    const rows = normalizeNumericRows(
      await qb.executeQuery().then((result) => result.fetchAllAssociative()),
    );

    expect(rows).toEqual([{ virtual_id: 1 }]);
  });

  it("platform does not support CTE", async ({ skip }) => {
    const connection = functional.connection();
    if (platformSupportsCTEs(connection.getDatabasePlatform())) {
      skip();
    }

    const qb = connection.createQueryBuilder();
    const cteQueryBuilder = qb.sub().select("id").from("for_update");
    qb.with("cte_a", cteQueryBuilder).select("id").from("cte_a");

    await expect(qb.executeQuery()).rejects.toThrow(NotSupported);
  });
});

function normalizeNumericRows(
  rows: Array<Record<string, unknown>>,
): Array<Record<string, number | string | null>> {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key.toLowerCase(),
        typeof value === "number"
          ? value
          : typeof value === "bigint"
            ? Number(value)
            : typeof value === "string" && /^-?\d+$/.test(value)
              ? Number(value)
              : (value as string | null),
      ]),
    ),
  );
}

function platformSupportsSkipLocked(platform: unknown): boolean {
  if (platform instanceof DB2Platform) {
    return false;
  }

  if (platform instanceof MySQLPlatform) {
    return platform instanceof MySQL80Platform;
  }

  if (platform instanceof MariaDBPlatform) {
    return platform instanceof MariaDB1060Platform;
  }

  return !(platform instanceof SQLitePlatform);
}

function platformSupportsCTEs(platform: unknown): boolean {
  return !(platform instanceof MySQLPlatform) || platform instanceof MySQL80Platform;
}

function platformSupportsCTEColumnsDefinition(platform: unknown): boolean {
  if (platform instanceof DB2Platform || platform instanceof OraclePlatform) {
    return false;
  }

  return !(platform instanceof MySQLPlatform) || platform instanceof MySQL80Platform;
}
