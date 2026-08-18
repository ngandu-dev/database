import { beforeEach, describe, expect, it } from "vitest";

import type { Connection } from "../../../connection";
import { NoKeyValue } from "../../../exception/no-key-value";
import { SQLServerPlatform } from "../../../platforms/sqlserver-platform";
import { TestUtil } from "../../test-util";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Connection/FetchTest", () => {
  const functional = useFunctionalTestCase();
  let connection: Connection;
  let query = "";

  beforeEach(async () => {
    connection = functional.connection();
    query = TestUtil.generateResultSetQuery(
      ["a", "b"],
      [
        ["foo", 1],
        ["bar", 2],
        ["baz", 3],
      ],
      connection.getDatabasePlatform(),
    );
  });

  it("fetches numeric rows", async () => {
    expect(await connection.fetchNumeric(query)).toEqual(["foo", 1]);
  });

  it("fetches one value", async () => {
    expect(await connection.fetchOne(query)).toBe("foo");
  });

  it("fetches associative rows", async () => {
    expect(await connection.fetchAssociative(query)).toEqual({
      a: "foo",
      b: 1,
    });
  });

  it("fetches all numeric rows", async () => {
    expect(await connection.fetchAllNumeric(query)).toEqual([
      ["foo", 1],
      ["bar", 2],
      ["baz", 3],
    ]);
  });

  it("fetches all associative rows", async () => {
    expect(await connection.fetchAllAssociative(query)).toEqual([
      { a: "foo", b: 1 },
      { a: "bar", b: 2 },
      { a: "baz", b: 3 },
    ]);
  });

  it("fetches all key/value pairs", async () => {
    expect(await connection.fetchAllKeyValue(query)).toEqual({
      foo: 1,
      bar: 2,
      baz: 3,
    });
  });

  it("fetches key/value pairs from a limited result set", async ({ skip }) => {
    const platform = connection.getDatabasePlatform();
    if (platform instanceof SQLServerPlatform) {
      skip();
    }

    const limitedQuery = platform.modifyLimitQuery(query, 1, 1);

    expect(await connection.fetchAllKeyValue(limitedQuery)).toEqual({ bar: 2 });
  });

  it("rejects key/value fetch when only one column is present", async () => {
    await expect(
      connection.fetchAllKeyValue(connection.getDatabasePlatform().getDummySelectSQL()),
    ).rejects.toThrow(NoKeyValue);
  });

  it("fetches all associative indexed rows", async () => {
    expect(await connection.fetchAllAssociativeIndexed(query)).toEqual({
      foo: { b: 1 },
      bar: { b: 2 },
      baz: { b: 3 },
    });
  });

  it("fetches the first column", async () => {
    expect(await connection.fetchFirstColumn(query)).toEqual(["foo", "bar", "baz"]);
  });

  it("iterates numeric rows", async () => {
    expect(await collectAsync(connection.iterateNumeric(query))).toEqual([
      ["foo", 1],
      ["bar", 2],
      ["baz", 3],
    ]);
  });

  it("iterates associative rows", async () => {
    expect(await collectAsync(connection.iterateAssociative(query))).toEqual([
      { a: "foo", b: 1 },
      { a: "bar", b: 2 },
      { a: "baz", b: 3 },
    ]);
  });

  it("iterates key/value pairs", async () => {
    expect(Object.fromEntries(await collectAsync(connection.iterateKeyValue(query)))).toEqual({
      foo: 1,
      bar: 2,
      baz: 3,
    });
  });

  it("rejects key/value iteration when only one column is present", async () => {
    await expect(
      collectAsync(
        connection.iterateKeyValue(connection.getDatabasePlatform().getDummySelectSQL()),
      ),
    ).rejects.toThrow(NoKeyValue);
  });

  it("iterates associative indexed rows", async () => {
    expect(
      Object.fromEntries(await collectAsync(connection.iterateAssociativeIndexed(query))),
    ).toEqual({
      foo: { b: 1 },
      bar: { b: 2 },
      baz: { b: 3 },
    });
  });

  it("iterates the first column", async () => {
    expect(await collectAsync(connection.iterateColumn(query))).toEqual(["foo", "bar", "baz"]);
  });
});

async function collectAsync<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];

  for await (const value of iterable) {
    values.push(value);
  }

  return values;
}
