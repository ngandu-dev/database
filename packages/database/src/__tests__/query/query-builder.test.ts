import { describe, expect, it } from "vitest";

import { ArrayParameterType } from "../../array-parameter-type";
import { Connection } from "../../connection";
import type { Driver } from "../../driver";
import { ParameterBindingStyle } from "../../driver/_internal";
import type {
  ExceptionConverter,
  ExceptionConverterContext,
} from "../../driver/api/exception-converter";
import { ArrayResult } from "../../driver/array-result";
import type { Connection as DriverConnection } from "../../driver/connection";
import { DriverException } from "../../exception/driver-exception";
import { ParameterType } from "../../parameter-type";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import type { QueryParameterTypes, QueryParameters } from "../../query";
import { NonUniqueAlias } from "../../query/exception/non-unique-alias";
import { UnknownAlias } from "../../query/exception/unknown-alias";
import { CompositeExpression } from "../../query/expression/composite-expression";
import { ExpressionBuilder } from "../../query/expression/expression-builder";
import { ForUpdate } from "../../query/for-update";
import { ConflictResolutionMode } from "../../query/for-update/conflict-resolution-mode";
import { Join } from "../../query/join";
import { Limit } from "../../query/limit";
import { PlaceHolder, QueryBuilder } from "../../query/query-builder";
import { QueryException } from "../../query/query-exception";
import { SelectQuery } from "../../query/select-query";
import { Union } from "../../query/union";
import { UnionQuery } from "../../query/union-query";
import { UnionType } from "../../query/union-type";
import { Result } from "../../result";

describe("Query API surface parity", () => {
  it("adds SelectQuery getters and distinct flag accessor", () => {
    const limit = new Limit(10, 5);
    const forUpdate = new ForUpdate(ConflictResolutionMode.SKIP_LOCKED);
    const query = new SelectQuery(
      true,
      ["u.id", "u.email"],
      ["users u"],
      "u.active = 1",
      ["u.role_id"],
      "COUNT(*) > 1",
      ["u.id DESC"],
      limit,
      forUpdate,
    );

    expect(query.isDistinct()).toBe(true);
    expect(query.getColumns()).toEqual(["u.id", "u.email"]);
    expect(query.getFrom()).toEqual(["users u"]);
    expect(query.getWhere()).toBe("u.active = 1");
    expect(query.getGroupBy()).toEqual(["u.role_id"]);
    expect(query.getHaving()).toBe("COUNT(*) > 1");
    expect(query.getOrderBy()).toEqual(["u.id DESC"]);
    expect(query.getLimit()).toBe(limit);
    expect(query.getForUpdate()).toBe(forUpdate);
  });

  it("adds UnionQuery getters", () => {
    const limit = new Limit(25, 0);
    const unionA = new Union("SELECT 1");
    const unionB = new Union("SELECT 2");
    const query = new UnionQuery([unionA, unionB], ["id ASC"], limit);

    expect(query.getUnionParts()).toEqual([unionA, unionB]);
    expect(query.getOrderBy()).toEqual(["id ASC"]);
    expect(query.getLimit()).toBe(limit);
  });

  it("adds Join factories and ForUpdate conflict resolution getter", () => {
    const inner = Join.inner("phones", "p", "p.user_id = u.id");
    const left = Join.left("roles", "r", null);
    const right = Join.right("profiles", "pr", "pr.user_id = u.id");

    expect(inner.type).toBe("INNER");
    expect(left.type).toBe("LEFT");
    expect(right.type).toBe("RIGHT");

    const forUpdate = new ForUpdate(ConflictResolutionMode.ORDINARY);
    expect(forUpdate.getConflictResolutionMode()).toBe(ConflictResolutionMode.ORDINARY);
  });

  it("adds CompositeExpression and ExpressionBuilder public helpers", async () => {
    const andExpr = CompositeExpression.and("u.active = 1", "u.deleted_at IS NULL");
    const orExpr = CompositeExpression.or("u.role = 'admin'", "u.role = 'owner'");

    expect(andExpr.getType()).toBe("AND");
    expect(orExpr.getType()).toBe("OR");

    const connection = {
      quote: async (value: string) => `'${value}'`,
    } as unknown as Connection;
    const expr = new ExpressionBuilder(connection);

    expect(expr.and("a = 1", "b = 2").toString()).toContain("AND");
    expect(await expr.literal("abc")).toBe("'abc'");
  });

  it("adds query exception factory aliases", () => {
    const nonUnique = NonUniqueAlias.new("u", ["u", "a"]);
    const unknown = UnknownAlias.new("x", ["u", "a"]);

    expect(nonUnique).toBeInstanceOf(QueryException);
    expect(nonUnique.message).toContain('"u"');
    expect(unknown).toBeInstanceOf(QueryException);
    expect(unknown.message).toContain('"x"');
  });
});

class NoopExceptionConverter implements ExceptionConverter {
  public convert(error: unknown, context: ExceptionConverterContext): DriverException {
    return new DriverException("driver failure", {
      cause: error,
      driverName: "query-builder-noop",
      operation: context.operation,
      parameters: context.query?.parameters,
      sql: context.query?.sql,
    });
  }
}

class NoopDriverConnection implements DriverConnection {
  public async prepare(_sql: string) {
    return {
      bindValue: () => undefined,
      execute: async () => new ArrayResult([], [], 0),
    };
  }

  public async query(_sql: string) {
    return new ArrayResult([], [], 0);
  }

  public quote(value: string): string {
    return `'${value}'`;
  }

  public async exec(_sql: string): Promise<number | string> {
    return 0;
  }

  public async lastInsertId(): Promise<number | string> {
    return 0;
  }

  public async beginTransaction(): Promise<void> {}

  public async commit(): Promise<void> {}

  public async rollBack(): Promise<void> {}

  public async getServerVersion(): Promise<string> {
    return "0.0.0-test";
  }

  public async close(): Promise<void> {}

  public getNativeConnection(): unknown {
    return this;
  }
}

class NoopDriver implements Driver {
  public readonly name = "query-builder-noop";
  public readonly bindingStyle = ParameterBindingStyle.POSITIONAL;
  private readonly exceptionConverter = new NoopExceptionConverter();

  public async connect(_params: Record<string, unknown>): Promise<DriverConnection> {
    return new NoopDriverConnection();
  }

  public getExceptionConverter(): ExceptionConverter {
    return this.exceptionConverter;
  }

  public getDatabasePlatform(): MySQLPlatform {
    return new MySQLPlatform();
  }
}

class SpyExecutionConnection extends Connection {
  public readonly queryCalls: Array<{
    params: QueryParameters;
    sql: string;
    types: QueryParameterTypes;
  }> = [];
  public readonly statementCalls: Array<{
    params: QueryParameters;
    sql: string;
    types: QueryParameterTypes;
  }> = [];
  private readonly queryRows: Array<Record<string, unknown>>;
  private readonly statementResult: number;

  public constructor(
    options: {
      queryRows?: Array<Record<string, unknown>>;
      statementResult?: number;
    } = {},
  ) {
    super({ platform: new MySQLPlatform() }, new NoopDriver());
    this.queryRows = options.queryRows ?? [{ total: 7 }];
    this.statementResult = options.statementResult ?? 2;
  }

  public override async executeQuery(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<Result> {
    this.queryCalls.push({ params, sql, types });
    return new Result(new ArrayResult([...this.queryRows]), this);
  }

  public override async executeStatement(
    sql: string,
    params: QueryParameters = [],
    types: QueryParameterTypes = [],
  ): Promise<number> {
    this.statementCalls.push({ params, sql, types });
    return this.statementResult;
  }
}

const createQueryBuilder = (): QueryBuilder =>
  new Connection({ platform: new MySQLPlatform() }, new NoopDriver()).createQueryBuilder();

describe("QueryBuilder", () => {
  it("should instantiate without errors", () => {
    const qb = createQueryBuilder();
    expect(qb).toBeInstanceOf(QueryBuilder);
  });

  it("should create sub query builder", () => {
    const qb = createQueryBuilder();
    const sub = qb.sub();

    expect(sub).toBeInstanceOf(QueryBuilder);
    expect(sub).not.toBe(qb);
  });

  it("should build simple SELECT without FROM", () => {
    const qb = createQueryBuilder();
    qb.select("some_function()");
    expect(qb.toString()).toBe("SELECT some_function()");
  });

  it("should build simple SELECT with FROM and alias", () => {
    const qb = createQueryBuilder();
    qb.select("u.id").from("users", "u");
    expect(qb.toString()).toBe("SELECT u.id FROM users u");
  });

  it("should build simple SELECT with DISTINCT", () => {
    const qb = createQueryBuilder();
    qb.select("u.id").distinct().from("users", "u");
    expect(qb.toString()).toBe("SELECT DISTINCT u.id FROM users u");
  });

  it("should build SELECT with simple WHERE", () => {
    const qb = createQueryBuilder();
    const expr = qb.expr();

    qb.select("u.id")
      .from("users", "u")
      .where(expr.and(expr.eq("u.nickname", "?")));

    expect(qb.toString()).toBe("SELECT u.id FROM users u WHERE u.nickname = ?");
  });

  it("should build SELECT with LEFT JOIN", () => {
    const qb = createQueryBuilder();
    const expr = qb.expr();

    qb.select("u.*", "p.*")
      .from("users", "u")
      .leftJoin("u", "phones", "p", expr.eq("p.user_id", "u.id"));

    expect(qb.toString()).toBe(
      "SELECT u.*, p.* FROM users u LEFT JOIN phones p ON p.user_id = u.id",
    );
  });

  it("should build SELECT with INNER JOIN", () => {
    const qb = createQueryBuilder();
    const expr = qb.expr();

    qb.select("u.*", "p.*")
      .from("users", "u")
      .join("u", "phones", "p", expr.eq("p.user_id", "u.id"));

    expect(qb.toString()).toBe(
      "SELECT u.*, p.* FROM users u INNER JOIN phones p ON p.user_id = u.id",
    );
  });

  it("should build SELECT with INNER JOIN and no ON condition", () => {
    const qb = createQueryBuilder();

    qb.select("u.*", "p.*").from("users", "u").join("u", "phones", "p");

    expect(qb.toString()).toBe("SELECT u.*, p.* FROM users u INNER JOIN phones p");
  });

  it("should build SELECT with INNER JOIN (using innerJoin)", () => {
    const qb = createQueryBuilder();
    const expr = qb.expr();

    qb.select("u.*", "p.*")
      .from("users", "u")
      .innerJoin("u", "phones", "p", expr.eq("p.user_id", "u.id"));

    expect(qb.toString()).toBe(
      "SELECT u.*, p.* FROM users u INNER JOIN phones p ON p.user_id = u.id",
    );
  });

  it("should build SELECT with RIGHT JOIN", () => {
    const qb = createQueryBuilder();
    const expr = qb.expr();

    qb.select("u.*", "p.*")
      .from("users", "u")
      .rightJoin("u", "phones", "p", expr.eq("p.user_id", "u.id"));

    expect(qb.toString()).toBe(
      "SELECT u.*, p.* FROM users u RIGHT JOIN phones p ON p.user_id = u.id",
    );
  });

  it("should build SELECT with ANDed WHERE conditions", () => {
    const qb = createQueryBuilder();

    qb.select("u.*", "p.*").from("users", "u").where("u.username = ?").andWhere("u.name = ?");

    expect(qb.toString()).toBe(
      "SELECT u.*, p.* FROM users u WHERE (u.username = ?) AND (u.name = ?)",
    );
  });

  it("should build SELECT with ORed WHERE conditions", () => {
    const qb = createQueryBuilder();

    qb.select("u.*", "p.*").from("users", "u").where("u.username = ?").orWhere("u.name = ?");

    expect(qb.toString()).toBe(
      "SELECT u.*, p.* FROM users u WHERE (u.username = ?) OR (u.name = ?)",
    );
  });

  it("should build SELECT with two ORed WHERE conditions (orWhere only)", () => {
    const qb = createQueryBuilder();

    qb.select("u.*", "p.*").from("users", "u").orWhere("u.username = ?").orWhere("u.name = ?");

    expect(qb.toString()).toBe(
      "SELECT u.*, p.* FROM users u WHERE (u.username = ?) OR (u.name = ?)",
    );
  });

  it("should build SELECT with complex AND/OR WHERE conditions", () => {
    const qb = createQueryBuilder();

    qb.select("u.*", "p.*")
      .from("users", "u")
      .where("u.username = ?")
      .andWhere("u.username = ?")
      .orWhere("u.name = ?")
      .andWhere("u.name = ?");

    expect(qb.toString()).toBe(
      "SELECT u.*, p.* FROM users u WHERE (((u.username = ?) AND (u.username = ?)) OR (u.name = ?)) AND (u.name = ?)",
    );
  });

  it("should build SELECT with GROUP BY", () => {
    const qb = createQueryBuilder();

    qb.select("u.*", "p.*").from("users", "u").groupBy("u.id");

    expect(qb.toString()).toBe("SELECT u.*, p.* FROM users u GROUP BY u.id");
  });

  it("should build SELECT with GROUP BY and addGroupBy", () => {
    const qb = createQueryBuilder();

    qb.select("u.*", "p.*").from("users", "u").groupBy("u.id").addGroupBy("u.foo");

    expect(qb.toString()).toBe("SELECT u.*, p.* FROM users u GROUP BY u.id, u.foo");
  });

  it("should build SELECT with GROUP BY and multiple addGroupBy", () => {
    const qb = createQueryBuilder();

    qb.select("u.*", "p.*").from("users", "u").groupBy("u.id").addGroupBy("u.foo", "u.bar");

    expect(qb.toString()).toBe("SELECT u.*, p.* FROM users u GROUP BY u.id, u.foo, u.bar");
  });

  it("should build SELECT with HAVING", () => {
    const qb = createQueryBuilder();

    qb.select("u.*", "p.*").from("users", "u").groupBy("u.id").having("u.name = ?");

    expect(qb.toString()).toBe("SELECT u.*, p.* FROM users u GROUP BY u.id HAVING u.name = ?");
  });

  it("should build SELECT with andHaving (single)", () => {
    const qb = createQueryBuilder();

    qb.select("u.*", "p.*").from("users", "u").groupBy("u.id").andHaving("u.name = ?");

    expect(qb.toString()).toBe("SELECT u.*, p.* FROM users u GROUP BY u.id HAVING u.name = ?");
  });

  it("should build SELECT with HAVING and andHaving", () => {
    const qb = createQueryBuilder();

    qb.select("u.*", "p.*")
      .from("users", "u")
      .groupBy("u.id")
      .having("u.name = ?")
      .andHaving("u.username = ?");

    expect(qb.toString()).toBe(
      "SELECT u.*, p.* FROM users u GROUP BY u.id HAVING (u.name = ?) AND (u.username = ?)",
    );
  });

  it("should build SELECT with HAVING and orHaving", () => {
    const qb = createQueryBuilder();

    qb.select("u.*", "p.*")
      .from("users", "u")
      .groupBy("u.id")
      .having("u.name = ?")
      .orHaving("u.username = ?");

    expect(qb.toString()).toBe(
      "SELECT u.*, p.* FROM users u GROUP BY u.id HAVING (u.name = ?) OR (u.username = ?)",
    );
  });

  it("should build SELECT with two orHaving", () => {
    const qb = createQueryBuilder();

    qb.select("u.*", "p.*")
      .from("users", "u")
      .groupBy("u.id")
      .orHaving("u.name = ?")
      .orHaving("u.username = ?");

    expect(qb.toString()).toBe(
      "SELECT u.*, p.* FROM users u GROUP BY u.id HAVING (u.name = ?) OR (u.username = ?)",
    );
  });

  it("should build SELECT with HAVING, orHaving, and andHaving (complex grouping)", () => {
    const qb = createQueryBuilder();

    qb.select("u.*", "p.*")
      .from("users", "u")
      .groupBy("u.id")
      .having("u.name = ?")
      .orHaving("u.username = ?")
      .andHaving("u.username = ?");

    expect(qb.toString()).toBe(
      "SELECT u.*, p.* FROM users u GROUP BY u.id HAVING ((u.name = ?) OR (u.username = ?)) AND (u.username = ?)",
    );
  });

  it("should build SELECT with ORDER BY", () => {
    const qb = createQueryBuilder();

    qb.select("u.*", "p.*").from("users", "u").orderBy("u.name");

    expect(qb.toString()).toBe("SELECT u.*, p.* FROM users u ORDER BY u.name");
  });

  it("should build SELECT with ORDER BY and addOrderBy", () => {
    const qb = createQueryBuilder();

    qb.select("u.*", "p.*").from("users", "u").orderBy("u.name").addOrderBy("u.username", "DESC");

    expect(qb.toString()).toBe("SELECT u.*, p.* FROM users u ORDER BY u.name, u.username DESC");
  });

  it("should build SELECT with multiple addOrderBy", () => {
    const qb = createQueryBuilder();

    qb.select("u.*", "p.*")
      .from("users", "u")
      .addOrderBy("u.name")
      .addOrderBy("u.username", "DESC");

    expect(qb.toString()).toBe("SELECT u.*, p.* FROM users u ORDER BY u.name, u.username DESC");
  });

  it("should throw if select is empty", () => {
    const qb = createQueryBuilder();
    const qb2 = qb.select();

    expect(qb2).toBe(qb);
    expect(() => qb.getSQL()).toThrow();
  });

  it("should build SELECT with addSelect", () => {
    const qb = createQueryBuilder();

    qb.select("u.*").addSelect("p.*").from("users", "u");

    expect(qb.toString()).toBe("SELECT u.*, p.* FROM users u");
  });

  it("should build SELECT with multiple FROM", () => {
    const qb = createQueryBuilder();

    qb.select("u.*").addSelect("p.*").from("users", "u").from("phonenumbers", "p");

    expect(qb.toString()).toBe("SELECT u.*, p.* FROM users u, phonenumbers p");
  });

  it("should build UPDATE with multiple SET", () => {
    const qb = createQueryBuilder();
    qb.update("users").set("foo", "?").set("bar", "?");

    expect(qb.toString()).toBe("UPDATE users SET foo = ?, bar = ?");
  });

  it("should build UPDATE with SET and WHERE", () => {
    const qb = createQueryBuilder();
    qb.update("users").set("foo", "?").where("foo = ?");

    expect(qb.toString()).toBe("UPDATE users SET foo = ? WHERE foo = ?");
  });

  it("should build DELETE", () => {
    const qb = createQueryBuilder();
    qb.delete("users");

    expect(qb.toString()).toBe("DELETE FROM users");
  });

  it("should build DELETE with WHERE", () => {
    const qb = createQueryBuilder();
    qb.delete("users").where("u.foo = ?");

    expect(qb.toString()).toBe("DELETE FROM users WHERE u.foo = ?");
  });

  it("should build INSERT with values", () => {
    const qb = createQueryBuilder();
    qb.insert("users").values({ bar: "?", foo: "?" });

    expect(qb.toString()).toBe("INSERT INTO users (bar, foo) VALUES(?, ?)");
  });

  it("should build INSERT with replaced values (order and overwrite)", () => {
    const qb = createQueryBuilder();
    qb.insert("users").values({ bar: "?", foo: "?" }).values({ bar: "?", foo: "?" });

    expect(qb.toString()).toBe("INSERT INTO users (bar, foo) VALUES(?, ?)");
  });

  it("should build INSERT with setValue (overwrites previous)", () => {
    const qb = createQueryBuilder();
    qb.insert("users").setValue("foo", "bar").setValue("bar", "?").setValue("foo", "?");

    expect(qb.toString()).toBe("INSERT INTO users (foo, bar) VALUES(?, ?)");
  });

  it("should build INSERT with values and setValue", () => {
    const qb = createQueryBuilder();
    qb.insert("users").values({ foo: "?" }).setValue("bar", "?");

    expect(qb.toString()).toBe("INSERT INTO users (foo, bar) VALUES(?, ?)");
  });

  it.each([
    { maxResults: 10 },
    { maxResults: null },
  ])("should set and get maxResults: $maxResults", ({ maxResults }) => {
    const qb = createQueryBuilder();
    qb.setMaxResults(maxResults);
    expect(qb.getMaxResults()).toBe(maxResults);
  });

  it("should set and get firstResult", () => {
    const qb = createQueryBuilder();
    qb.setFirstResult(10);
    expect(qb.getFirstResult()).toBe(10);
  });

  function prepareQueryBuilderToReset() {
    const qb = createQueryBuilder()
      .select("u.*")
      .distinct()
      .from("users", "u")
      .where("u.name = ?")
      .orderBy("u.name", "ASC");
    expect(qb.toString()).toBe(
      "SELECT DISTINCT u.* FROM users u WHERE u.name = ? ORDER BY u.name ASC",
    );
    return qb;
  }

  it("should reset distinct", () => {
    const qb = prepareQueryBuilderToReset().distinct(false);
    expect(qb.toString()).toBe("SELECT u.* FROM users u WHERE u.name = ? ORDER BY u.name ASC");
  });

  it("should reset where", () => {
    const qb = prepareQueryBuilderToReset().resetWhere();
    expect(qb.toString()).toBe("SELECT DISTINCT u.* FROM users u ORDER BY u.name ASC");
  });

  it("should reset orderBy", () => {
    const qb = prepareQueryBuilderToReset().resetOrderBy();
    expect(qb.toString()).toBe("SELECT DISTINCT u.* FROM users u WHERE u.name = ?");
  });

  it("should reset having", () => {
    function prepareGroupedQueryBuilderToReset() {
      const qb = createQueryBuilder()
        .select("u.country", "COUNT(*)")
        .from("users", "u")
        .groupBy("u.country")
        .having("COUNT(*) > ?")
        .orderBy("COUNT(*)", "DESC");
      expect(qb.toString()).toBe(
        "SELECT u.country, COUNT(*) FROM users u GROUP BY u.country HAVING COUNT(*) > ? ORDER BY COUNT(*) DESC",
      );
      return qb;
    }

    const qb = prepareGroupedQueryBuilderToReset().resetHaving();
    expect(qb.toString()).toBe(
      "SELECT u.country, COUNT(*) FROM users u GROUP BY u.country ORDER BY COUNT(*) DESC",
    );
  });

  it("should reset groupBy", () => {
    function prepareGroupedQueryBuilderToReset() {
      const qb = createQueryBuilder()
        .select("u.country", "COUNT(*)")
        .from("users", "u")
        .groupBy("u.country")
        .having("COUNT(*) > ?")
        .orderBy("COUNT(*)", "DESC");
      expect(qb.toString()).toBe(
        "SELECT u.country, COUNT(*) FROM users u GROUP BY u.country HAVING COUNT(*) > ? ORDER BY COUNT(*) DESC",
      );
      return qb;
    }

    const qb = prepareGroupedQueryBuilderToReset().resetGroupBy();
    expect(qb.toString()).toBe(
      "SELECT u.country, COUNT(*) FROM users u HAVING COUNT(*) > ? ORDER BY COUNT(*) DESC",
    );
  });

  it("should create named parameter", () => {
    const qb = createQueryBuilder();
    qb.select("u.*")
      .from("users", "u")
      .where(qb.expr().eq("u.name", qb.createNamedParameter(10, ParameterType.INTEGER, "name")));

    expect(qb.toString()).toBe("SELECT u.* FROM users u WHERE u.name = :name");
    expect(qb.getParameter("name")).toBe(10);
    expect(qb.getParameterType("name")).toBe(ParameterType.INTEGER);
  });

  it("should create named parameter with default placeholder", () => {
    const qb = createQueryBuilder();
    qb.select("u.*")
      .from("users", "u")
      .where(qb.expr().eq("u.name", qb.createNamedParameter(10)));

    expect(qb.toString()).toBe("SELECT u.* FROM users u WHERE u.name = :dcValue1");
    expect(qb.getParameter("dcValue1")).toBe(10);
    expect(qb.getParameterType("dcValue1")).toBe(ParameterType.STRING);
  });

  it("should create named parameter with custom placeholder", () => {
    const qb = createQueryBuilder();
    qb.select("u.*")
      .from("users", "u")
      .where(qb.expr().eq("u.name", qb.createNamedParameter(10, ParameterType.INTEGER, ":test")));

    expect(qb.toString()).toBe("SELECT u.* FROM users u WHERE u.name = :test");
    expect(qb.getParameter("test")).toBe(10);
    expect(qb.getParameterType("test")).toBe(ParameterType.INTEGER);
  });

  it("should create positional parameter", () => {
    const qb = createQueryBuilder();
    qb.select("u.*")
      .from("users", "u")
      .where(qb.expr().eq("u.name", qb.createPositionalParameter(10, ParameterType.INTEGER)));

    expect(qb.toString()).toBe("SELECT u.* FROM users u WHERE u.name = ?");
    expect(qb.getParameter(0)).toBe(10);
    expect(qb.getParameterType(0)).toBe(ParameterType.INTEGER);
  });

  it("should throw on invalid join alias", () => {
    const qb = createQueryBuilder();
    qb.select("COUNT(DISTINCT news.id)")
      .from("cb_newspages", "news")
      .innerJoin("news", "nodeversion", "nv", "nv.refId = news.id AND nv.refEntityname='News'")
      .innerJoin("invalid", "nodetranslation", "nt", "nv.nodetranslation = nt.id")
      .innerJoin("nt", "node", "n", "nt.node = n.id")
      .where("nt.lang = :lang AND n.deleted != 1");

    expect(() => qb.getSQL()).toThrow(QueryException);
    // Optionally check error message if needed
  });

  it("should build SELECT with joins and WHERE on joined tables", () => {
    const qb = createQueryBuilder();
    qb.select("COUNT(DISTINCT news.id)")
      .from("newspages", "news")
      .innerJoin(
        "news",
        "nodeversion",
        "nv",
        "nv.refId = news.id AND nv.refEntityname='Entity\\News'",
      )
      .innerJoin("nv", "nodetranslation", "nt", "nv.nodetranslation = nt.id")
      .innerJoin("nt", "node", "n", "nt.node = n.id")
      .where("nt.lang = ?")
      .andWhere("n.deleted = 0");

    expect(qb.getSQL()).toBe(
      "SELECT COUNT(DISTINCT news.id) FROM newspages news" +
        " INNER JOIN nodeversion nv ON nv.refId = news.id AND nv.refEntityname='Entity\\News'" +
        " INNER JOIN nodetranslation nt ON nv.nodetranslation = nt.id" +
        " INNER JOIN node n ON nt.node = n.id WHERE (nt.lang = ?) AND (n.deleted = 0)",
    );
  });

  it("should build SELECT with multiple FROM and joins", () => {
    const qb = createQueryBuilder();
    qb.select("DISTINCT u.id")
      .from("users", "u")
      .from("articles", "a")
      .innerJoin("u", "permissions", "p", "p.user_id = u.id")
      .innerJoin("a", "comments", "c", "c.article_id = a.id")
      .where("u.id = a.user_id")
      .andWhere("p.read = 1");

    expect(qb.getSQL()).toBe(
      "SELECT DISTINCT u.id FROM users u" +
        " INNER JOIN permissions p ON p.user_id = u.id, articles a" +
        " INNER JOIN comments c ON c.article_id = a.id" +
        " WHERE (u.id = a.user_id) AND (p.read = 1)",
    );
  });

  it("should build SELECT with joins and multiple ON conditions (parse order)", () => {
    const qb = createQueryBuilder();
    qb.select("a.id")
      .from("table_a", "a")
      .join("a", "table_b", "b", "a.fk_b = b.id")
      .join("b", "table_c", "c", "c.fk_b = b.id AND b.language = ?")
      .join("a", "table_d", "d", "a.fk_d = d.id")
      .join("c", "table_e", "e", "e.fk_c = c.id AND e.fk_d = d.id");

    expect(qb.toString()).toBe(
      "SELECT a.id " +
        "FROM table_a a " +
        "INNER JOIN table_b b ON a.fk_b = b.id " +
        "INNER JOIN table_d d ON a.fk_d = d.id " +
        "INNER JOIN table_c c ON c.fk_b = b.id AND b.language = ? " +
        "INNER JOIN table_e e ON e.fk_c = c.id AND e.fk_d = d.id",
    );
  });

  it("should build SELECT with multiple FROMs and joins with multiple ON conditions (parse order)", () => {
    const qb = createQueryBuilder();
    qb.select("a.id")
      .from("table_a", "a")
      .from("table_f", "f")
      .join("a", "table_b", "b", "a.fk_b = b.id")
      .join("b", "table_c", "c", "c.fk_b = b.id AND b.language = ?")
      .join("a", "table_d", "d", "a.fk_d = d.id")
      .join("c", "table_e", "e", "e.fk_c = c.id AND e.fk_d = d.id")
      .join("f", "table_g", "g", "f.fk_g = g.id");

    expect(qb.toString()).toBe(
      "SELECT a.id " +
        "FROM table_a a " +
        "INNER JOIN table_b b ON a.fk_b = b.id " +
        "INNER JOIN table_d d ON a.fk_d = d.id " +
        "INNER JOIN table_c c ON c.fk_b = b.id AND b.language = ? " +
        "INNER JOIN table_e e ON e.fk_c = c.id AND e.fk_d = d.id, " +
        "table_f f " +
        "INNER JOIN table_g g ON f.fk_g = g.id",
    );
  });

  it("should build simple SELECT without table alias", () => {
    const qb = createQueryBuilder();
    qb.select("id").from("users");
    expect(qb.toString()).toBe("SELECT id FROM users");
  });

  it("should build simple SELECT with matching table alias", () => {
    const qb = createQueryBuilder();
    qb.select("id").from("users", "users");
    expect(qb.toString()).toBe("SELECT id FROM users");
  });

  it("should build SELECT with simple WHERE without table alias", () => {
    const qb = createQueryBuilder();
    qb.select("id", "name").from("users").where("awesome=9001");
    expect(qb.toString()).toBe("SELECT id, name FROM users WHERE awesome=9001");
  });

  it("should build complex SELECT without table aliases", () => {
    const qb = createQueryBuilder();
    qb.select("DISTINCT users.id")
      .from("users")
      .from("articles")
      .innerJoin("users", "permissions", "p", "p.user_id = users.id")
      .innerJoin("articles", "comments", "c", "c.article_id = articles.id")
      .where("users.id = articles.user_id")
      .andWhere("p.read = 1");

    expect(qb.getSQL()).toBe(
      "SELECT DISTINCT users.id FROM users" +
        " INNER JOIN permissions p ON p.user_id = users.id, articles" +
        " INNER JOIN comments c ON c.article_id = articles.id" +
        " WHERE (users.id = articles.user_id) AND (p.read = 1)",
    );
  });

  it("should build complex SELECT with some table aliases", () => {
    const qb = createQueryBuilder();
    qb.select("u.id")
      .from("users", "u")
      .from("articles")
      .innerJoin("u", "permissions", "p", "p.user_id = u.id")
      .innerJoin("articles", "comments", "c", "c.article_id = articles.id");

    expect(qb.getSQL()).toBe(
      "SELECT u.id FROM users u" +
        " INNER JOIN permissions p ON p.user_id = u.id, articles" +
        " INNER JOIN comments c ON c.article_id = articles.id",
    );
  });

  it("should build SELECT all from table without table alias", () => {
    const qb = createQueryBuilder();
    qb.select("users.*").from("users");
    expect(qb.toString()).toBe("SELECT users.* FROM users");
  });

  it("should build SELECT all without table alias", () => {
    const qb = createQueryBuilder();
    qb.select("*").from("users");
    expect(qb.toString()).toBe("SELECT * FROM users");
  });

  it("should build SELECT with CTE", () => {
    const cteQueryBuilder1 = createQueryBuilder();
    cteQueryBuilder1
      .select("ta.id", "ta.name", "ta.table_b_id")
      .from("table_a", "ta")
      .where("ta.name LIKE :name");

    const cteQueryBuilder2 = createQueryBuilder();
    cteQueryBuilder2
      .select("ca.id AS virtual_id, ca.name AS virtual_name")
      .from("cte_a", "ca")
      .join("ca", "table_b", "tb", "ca.table_b_id = tb.id");

    const qb = createQueryBuilder();
    qb.with("cte_a", cteQueryBuilder1)
      .with("cte_b", cteQueryBuilder2, ["virtual_id", "virtual_name"])
      .select("cb.*")
      .from("cte_b", "cb");

    expect(qb.toString()).toBe(
      "WITH cte_a AS (SELECT ta.id, ta.name, ta.table_b_id FROM table_a ta WHERE ta.name LIKE :name)" +
        ", cte_b (virtual_id, virtual_name) AS " +
        "(SELECT ca.id AS virtual_id, ca.name AS virtual_name " +
        "FROM cte_a ca INNER JOIN table_b tb ON ca.table_b_id = tb.id) " +
        "SELECT cb.* FROM cte_b cb",
    );
  });

  it("should throw if CTE columns array is empty", () => {
    const qb = createQueryBuilder();
    expect(() => qb.with("cte_a", "SELECT 1 as id", [])).toThrowError(
      new QueryException('Columns defined in CTE "cte_a" should not be an empty array.'),
    );
  });

  it("should get parameter type", () => {
    const qb = createQueryBuilder();
    qb.select("*").from("users");
    expect(qb.getParameterType("name")).toBe(ParameterType.STRING);

    qb.where("name = :name");
    qb.setParameter("name", "foo");
    expect(qb.getParameterType("name")).toBe(ParameterType.STRING);

    qb.setParameter("name", "foo", ParameterType.INTEGER);
    expect(qb.getParameterType("name")).toBe(ParameterType.INTEGER);
  });

  it("should get parameter types", () => {
    const qb = createQueryBuilder();
    qb.select("*").from("users");
    expect(qb.getParameterTypes()).toEqual({});

    qb.where("name = :name");
    qb.setParameter("name", "foo");
    expect(qb.getParameterTypes()).toEqual({ name: ParameterType.STRING });

    qb.where("is_active = :isActive");
    qb.setParameter("isActive", true, ParameterType.BOOLEAN);
    expect(qb.getParameterTypes()).toEqual({
      isActive: ParameterType.BOOLEAN,
      name: ParameterType.STRING,
    });
  });

  it("should handle array parameters and their types", () => {
    const qb = createQueryBuilder();
    qb.select("*").from("users");
    expect(qb.getParameterTypes()).toEqual({});

    qb.where("id IN (:ids)");
    qb.setParameter("ids", [1, 2, 3], ArrayParameterType.INTEGER);

    qb.andWhere("name IN (:names)");
    qb.setParameter("names", ["john", "jane"], ArrayParameterType.STRING);

    qb.andWhere("hash IN (:hashes)");
    qb.setParameter(
      "hashes",
      [Uint8Array.from([0xde, 0xad, 0xbe, 0xef]), Uint8Array.from([0xc0, 0xde, 0xf0, 0x0d])],
      ArrayParameterType.BINARY,
    );

    expect(qb.getParameterType("ids")).toBe(ArrayParameterType.INTEGER);
    expect(qb.getParameterType("names")).toBe(ArrayParameterType.STRING);
    expect(qb.getParameterType("hashes")).toBe(ArrayParameterType.BINARY);

    expect(qb.getParameterTypes()).toEqual({
      hashes: ArrayParameterType.BINARY,
      ids: ArrayParameterType.INTEGER,
      names: ArrayParameterType.STRING,
    });
  });

  it("should throw if join uses a non-unique alias", () => {
    const qb = createQueryBuilder();
    qb.select("a.id").from("table_a", "a").join("a", "table_b", "a", "a.fk_b = a.id");

    expect(() => qb.getSQL()).toThrowError(
      new QueryException(
        `The given alias "a" is not unique in FROM and JOIN clause table. The currently registered aliases are: a.`,
      ),
    );
  });

  it("should throw if join uses unknown alias", () => {
    const qb = createQueryBuilder();
    qb.select("a.id").from("table_a", "a").join("c", "table_b", "b", "b.fk_a = a.id");

    expect(() => qb.getSQL()).toThrowError(
      new QueryException(
        `The given alias "c" is not part of any FROM or JOIN clause table. The currently registered aliases are: a.`,
      ),
    );
  });

  it("should throw if only one UNION part is given", () => {
    const qb = createQueryBuilder();
    qb.union("SELECT 1 AS field_one");

    expect(() => qb.getSQL()).toThrowError(
      new QueryException(
        "Insufficient UNION parts given, need at least 2. Please use union() and addUnion() to set enough UNION parts.",
      ),
    );
  });

  it("should build UNION ALL query with LIMIT and OFFSET", () => {
    const qb = createQueryBuilder();
    qb.union("SELECT 1 AS field_one")
      .addUnion("SELECT 2 as field_one", UnionType.ALL)
      .setMaxResults(10)
      .setFirstResult(10);

    expect(qb.getSQL()).toBe(
      "(SELECT 1 AS field_one) UNION ALL (SELECT 2 as field_one) LIMIT 10 OFFSET 10",
    );
  });

  it("should build UNION ALL query with ORDER BY", () => {
    const qb = createQueryBuilder();
    qb.union("SELECT 1 AS field_one")
      .addUnion("SELECT 2 as field_one", UnionType.ALL)
      .orderBy("field_one", "ASC");

    expect(qb.getSQL()).toBe(
      "(SELECT 1 AS field_one) UNION ALL (SELECT 2 as field_one) ORDER BY field_one ASC",
    );
  });

  it("should throw if addUnion is called before union", () => {
    const qb = createQueryBuilder();
    expect(() => qb.addUnion("SELECT 1 AS field_one", UnionType.DISTINCT)).toThrow(QueryException);
  });

  it("should build UNION DISTINCT query", () => {
    const qb = createQueryBuilder();
    qb.union("SELECT 1 AS field_one").addUnion("SELECT 2 as field_one", UnionType.DISTINCT);
    expect(qb.getSQL()).toBe("(SELECT 1 AS field_one) UNION (SELECT 2 as field_one)");
  });

  it("should build UNION query with DISTINCT as default", () => {
    const qb = createQueryBuilder();
    qb.union("SELECT 1 AS field_one").addUnion("SELECT 2 as field_one");
    expect(qb.getSQL()).toBe("(SELECT 1 AS field_one) UNION (SELECT 2 as field_one)");
  });

  it("should build UNION query with ORDER BY", () => {
    const qb = createQueryBuilder();
    qb.union("SELECT 1 AS field_one")
      .addUnion("SELECT 2 as field_one", UnionType.DISTINCT)
      .orderBy("field_one", "ASC");
    expect(qb.getSQL()).toBe(
      "(SELECT 1 AS field_one) UNION (SELECT 2 as field_one) ORDER BY field_one ASC",
    );
  });

  it("should build INSERT with insertWith", () => {
    const qb = createQueryBuilder();
    qb.insertWith("users", { bar: 42, foo: "bar" });
    expect(qb.toString()).toBe("INSERT INTO users (bar, foo) VALUES(?, ?)");
    expect(qb.getParameter(1)).toBe("bar");
    expect(qb.getParameter(0)).toBe(42);
    expect(qb.getParameters()).toStrictEqual([42, "bar"]);
  });

  it("should build UPDATE with updateWith", () => {
    const qb = createQueryBuilder();
    qb.updateWith("users", { bar: 42, foo: "bar" });
    expect(qb.toString()).toBe("UPDATE users SET bar = ?, foo = ?");
    expect(qb.getParameter(1)).toBe("bar");
    expect(qb.getParameter(0)).toBe(42);
    expect(qb.getParameters()).toStrictEqual([42, "bar"]);
  });

  it("should build INSERT with insertWith and named parameters", () => {
    const qb = createQueryBuilder();
    qb.insertWith("users", { bar: 42, foo: "bar" }, PlaceHolder.NAMED);
    expect(qb.toString()).toBe("INSERT INTO users (bar, foo) VALUES(:bar, :foo)");
    expect(qb.getParameter("foo")).toBe("bar");
    expect(qb.getParameter("bar")).toBe(42);
    expect({ ...qb.getParameters() }).toStrictEqual({ bar: 42, foo: "bar" });
  });

  it("should build UPDATE with updateWith and named parameters", () => {
    const qb = createQueryBuilder();
    qb.updateWith("users", { bar: 42, foo: "bar" }, PlaceHolder.NAMED);
    expect(qb.toString()).toBe("UPDATE users SET bar = :bar, foo = :foo");
    expect(qb.getParameter("foo")).toBe("bar");
    expect(qb.getParameter("bar")).toBe(42);
    expect({ ...qb.getParameters() }).toStrictEqual({ bar: 42, foo: "bar" });
  });

  it("should throw if insertWith is called with empty data", () => {
    const qb = createQueryBuilder();
    expect(() => qb.insertWith("users", {})).toThrow(QueryException);
  });

  it("should throw if updateWith is called with empty data", () => {
    const qb = createQueryBuilder();
    expect(() => qb.updateWith("users", {})).toThrow(QueryException);
  });

  it("should execute query through connection", async () => {
    const connection = new SpyExecutionConnection();
    const qb = connection.createQueryBuilder();
    qb.select("COUNT(*) AS total")
      .from("users", "u")
      .where("u.status = :status")
      .setParameter("status", "active");

    expect(await qb.fetchOne<number>()).toBe(7);
    expect(connection.queryCalls).toEqual([
      {
        params: { status: "active" },
        sql: "SELECT COUNT(*) AS total FROM users u WHERE u.status = :status",
        types: { status: ParameterType.STRING },
      },
    ]);
  });

  it("should fetch associative through connection", async () => {
    const connection = new SpyExecutionConnection({
      queryRows: [{ id: 1, name: "Alice" }],
    });
    const qb = connection.createQueryBuilder();
    qb.select("u.id", "u.name")
      .from("users", "u")
      .where("u.id = :id")
      .setParameter("id", 1, ParameterType.INTEGER);

    expect(await qb.fetchAssociative<{ id: number; name: string }>()).toEqual({
      id: 1,
      name: "Alice",
    });
    expect(connection.queryCalls).toEqual([
      {
        params: { id: 1 },
        sql: "SELECT u.id, u.name FROM users u WHERE u.id = :id",
        types: { id: ParameterType.INTEGER },
      },
    ]);
  });

  it("should fetch numeric through connection", async () => {
    const connection = new SpyExecutionConnection({
      queryRows: [{ id: 1, name: "Alice" }],
    });
    const qb = connection.createQueryBuilder();
    qb.select("u.id", "u.name").from("users", "u");

    expect(await qb.fetchNumeric<[number, string]>()).toEqual([1, "Alice"]);
    expect(connection.queryCalls).toHaveLength(1);
  });

  it("should fetch all numeric through connection", async () => {
    const connection = new SpyExecutionConnection({
      queryRows: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
    });
    const qb = connection.createQueryBuilder();
    qb.select("u.id", "u.name").from("users", "u");

    expect(await qb.fetchAllNumeric<[number, string]>()).toEqual([
      [1, "Alice"],
      [2, "Bob"],
    ]);
    expect(connection.queryCalls).toHaveLength(1);
  });

  it("should fetch all associative through connection", async () => {
    const connection = new SpyExecutionConnection({
      queryRows: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
    });
    const qb = connection.createQueryBuilder();
    qb.select("u.id", "u.name").from("users", "u");

    expect(await qb.fetchAllAssociative<{ id: number; name: string }>()).toEqual([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);
    expect(connection.queryCalls).toHaveLength(1);
  });

  it("should fetch all key value through connection", async () => {
    const connection = new SpyExecutionConnection({
      queryRows: [
        { id: "u1", name: "Alice" },
        { id: "u2", name: "Bob" },
      ],
    });
    const qb = connection.createQueryBuilder();
    qb.select("u.id", "u.name").from("users", "u");

    expect(await qb.fetchAllKeyValue<string>()).toEqual({
      u1: "Alice",
      u2: "Bob",
    });
    expect(connection.queryCalls).toHaveLength(1);
  });

  it("should fetch all associative indexed through connection", async () => {
    const connection = new SpyExecutionConnection({
      queryRows: [
        { id: "u1", name: "Alice", active: true },
        { id: "u2", name: "Bob", active: false },
      ],
    });
    const qb = connection.createQueryBuilder();
    qb.select("u.id", "u.name", "u.active").from("users", "u");

    expect(await qb.fetchAllAssociativeIndexed<{ name: string; active: boolean }>()).toEqual({
      u1: { active: true, name: "Alice" },
      u2: { active: false, name: "Bob" },
    });
    expect(connection.queryCalls).toHaveLength(1);
  });

  it("should fetch first column through connection", async () => {
    const connection = new SpyExecutionConnection({
      queryRows: [
        { id: 1, name: "Alice" },
        { id: 2, name: "Bob" },
      ],
    });
    const qb = connection.createQueryBuilder();
    qb.select("u.id", "u.name").from("users", "u");

    expect(await qb.fetchFirstColumn<number>()).toEqual([1, 2]);
    expect(connection.queryCalls).toHaveLength(1);
  });

  it("should execute statement through connection", async () => {
    const connection = new SpyExecutionConnection();
    const qb = connection.createQueryBuilder();
    qb.update("users")
      .set("name", ":name")
      .where("id = :id")
      .setParameter("name", "Jane")
      .setParameter("id", 42, ParameterType.INTEGER);

    expect(await qb.executeStatement()).toBe(2);
    expect(connection.statementCalls).toEqual([
      {
        params: { id: 42, name: "Jane" },
        sql: "UPDATE users SET name = :name WHERE id = :id",
        types: { id: ParameterType.INTEGER, name: ParameterType.STRING },
      },
    ]);
  });
});
