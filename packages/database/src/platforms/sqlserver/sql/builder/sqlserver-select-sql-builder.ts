import { ConflictResolutionMode } from "../../../../query/for-update/conflict-resolution-mode";
import { SelectQuery } from "../../../../query/select-query";
import { SelectSQLBuilder } from "../../../../sql/builder/select-sql-builder";
import type { AbstractPlatform } from "../../../abstract-platform";

export class SQLServerSelectSQLBuilder implements SelectSQLBuilder {
  public constructor(private readonly platform: AbstractPlatform) {}

  public buildSQL(query: SelectQuery): string {
    const parts: string[] = ["SELECT"];

    if (query.isDistinct()) {
      parts.push("DISTINCT");
    }

    parts.push(query.getColumns().join(", "));

    const from = query.getFrom();
    if (from.length > 0) {
      parts.push(`FROM ${from.join(", ")}`);
    }

    const forUpdate = query.getForUpdate();
    if (forUpdate !== null) {
      const withHints = ["UPDLOCK", "ROWLOCK"];
      if (forUpdate.getConflictResolutionMode() === ConflictResolutionMode.SKIP_LOCKED) {
        withHints.push("READPAST");
      }

      parts.push(`WITH (${withHints.join(", ")})`);
    }

    const where = query.getWhere();
    if (where !== null) {
      parts.push(`WHERE ${where}`);
    }

    const groupBy = query.getGroupBy();
    if (groupBy.length > 0) {
      parts.push(`GROUP BY ${groupBy.join(", ")}`);
    }

    const having = query.getHaving();
    if (having !== null) {
      parts.push(`HAVING ${having}`);
    }

    const orderBy = query.getOrderBy();
    if (orderBy.length > 0) {
      parts.push(`ORDER BY ${orderBy.join(", ")}`);
    }

    let sql = parts.join(" ");
    const limit = query.getLimit();
    if (limit.isDefined()) {
      sql = this.platform.modifyLimitQuery(sql, limit.getMaxResults(), limit.getFirstResult());
    }

    return sql;
  }
}
