import { beforeEach, describe, expect, it } from "vitest";

import type { Connection } from "../../../connection";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Connection/FetchEmptyTest", () => {
  const functional = useFunctionalTestCase();
  let connection: Connection;
  let query = "";

  beforeEach(async () => {
    connection = functional.connection();
    query = `SELECT * FROM (${connection.getDatabasePlatform().getDummySelectSQL("1 c")}) t WHERE 1 = 0`;
  });

  it("returns undefined for fetchAssociative()", async () => {
    expect(await connection.fetchAssociative(query)).toBeUndefined();
  });

  it("returns undefined for fetchNumeric()", async () => {
    expect(await connection.fetchNumeric(query)).toBeUndefined();
  });

  it("returns undefined for fetchOne()", async () => {
    expect(await connection.fetchOne(query)).toBeUndefined();
  });

  it("returns an empty array for fetchAllAssociative()", async () => {
    expect(await connection.fetchAllAssociative(query)).toEqual([]);
  });

  it("returns an empty array for fetchAllNumeric()", async () => {
    expect(await connection.fetchAllNumeric(query)).toEqual([]);
  });

  it("returns an empty array for fetchFirstColumn()", async () => {
    expect(await connection.fetchFirstColumn(query)).toEqual([]);
  });
});
