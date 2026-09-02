import {
  ArrayParameterType as BuilderArrayParameterType,
  ConflictResolutionMode as BuilderConflictResolutionMode,
  DB2Platform as BuilderDB2Platform,
  DefaultSelectSQLBuilder as BuilderDefaultSelectSQLBuilder,
  MySQL80Platform as BuilderMySQL80Platform,
  MySQLPlatform as BuilderMySQLPlatform,
  NotSupported as BuilderNotSupported,
  ParameterType as BuilderParameterType,
  SelectQuery as BuilderSelectQuery,
  SQLServerPlatform as BuilderSQLServerPlatform,
  UnionType as BuilderUnionType,
  QueryBuilder,
} from "@ngandu-dev/query-builder";
import { describe, expect, it } from "vitest";

import { ArrayParameterType } from "../../array-parameter-type";
import { ExpandArrayParameters } from "../../expand-array-parameters";
import { ParameterType } from "../../parameter-type";
import { DB2Platform } from "../../platforms/db2-platform";
import { NotSupported } from "../../platforms/exception/not-supported";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { MySQL80Platform } from "../../platforms/mysql80-platform";
import { SQLServerPlatform } from "../../platforms/sqlserver-platform";
import { ConflictResolutionMode } from "../../query/for-update/conflict-resolution-mode";
import { SelectQuery } from "../../query/select-query";
import { UnionType } from "../../query/union-type";
import { DefaultSelectSQLBuilder } from "../../sql/builder/default-select-sql-builder";
import { Parser } from "../../sql/parser";

const buildLockedSelect = (
  platform: ConstructorParameters<typeof QueryBuilder>[0],
  mode: BuilderConflictResolutionMode = BuilderConflictResolutionMode.ORDINARY,
): string => new QueryBuilder(platform).select("*").from("items").forUpdate(mode).getSQL();

describe("query-builder package contract", () => {
  it("uses one canonical set of public query and binding symbols", () => {
    expect(ArrayParameterType).toBe(BuilderArrayParameterType);
    expect(ParameterType).toBe(BuilderParameterType);
    expect(ConflictResolutionMode).toBe(BuilderConflictResolutionMode);
    expect(UnionType).toBe(BuilderUnionType);
    expect(SelectQuery).toBe(BuilderSelectQuery);
    expect(DefaultSelectSQLBuilder).toBe(BuilderDefaultSelectSQLBuilder);
    expect(NotSupported).toBe(BuilderNotSupported);
  });

  it("expands arrays created with the standalone package binding enum", () => {
    const visitor = new ExpandArrayParameters(
      { ids: [1, 2, 3] },
      { ids: BuilderArrayParameterType.INTEGER },
    );

    new Parser().parse("id IN (:ids)", visitor);

    expect(visitor.getSQL()).toBe("id IN (?, ?, ?)");
    expect(visitor.getParameters()).toEqual([1, 2, 3]);
    expect(visitor.getTypes()).toEqual([
      ParameterType.INTEGER,
      ParameterType.INTEGER,
      ParameterType.INTEGER,
    ]);
  });

  it("generates identical DB2 locking SQL through both platform surfaces", () => {
    expect(buildLockedSelect(new BuilderDB2Platform())).toBe(buildLockedSelect(new DB2Platform()));
    expect(buildLockedSelect(new DB2Platform())).toBe(
      "SELECT * FROM items WITH RR USE AND KEEP UPDATE LOCKS",
    );

    expect(() =>
      buildLockedSelect(new BuilderDB2Platform(), BuilderConflictResolutionMode.SKIP_LOCKED),
    ).toThrow(BuilderNotSupported);
  });

  it("generates identical SQL Server locking SQL through both platform surfaces", () => {
    expect(buildLockedSelect(new BuilderSQLServerPlatform())).toBe(
      buildLockedSelect(new SQLServerPlatform()),
    );
    expect(
      buildLockedSelect(new BuilderSQLServerPlatform(), BuilderConflictResolutionMode.SKIP_LOCKED),
    ).toBe("SELECT * FROM items WITH (UPDLOCK, ROWLOCK, READPAST)");
  });

  it("keeps version-aware MySQL locking behavior aligned", () => {
    expect(() =>
      buildLockedSelect(new BuilderMySQLPlatform(), BuilderConflictResolutionMode.SKIP_LOCKED),
    ).toThrow(BuilderNotSupported);
    expect(() =>
      buildLockedSelect(new MySQLPlatform(), BuilderConflictResolutionMode.SKIP_LOCKED),
    ).toThrow(BuilderNotSupported);

    expect(
      buildLockedSelect(new BuilderMySQL80Platform(), BuilderConflictResolutionMode.SKIP_LOCKED),
    ).toBe(buildLockedSelect(new MySQL80Platform(), BuilderConflictResolutionMode.SKIP_LOCKED));
  });
});
