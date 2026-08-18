import { beforeEach, describe, expect, it } from "vitest";

import type { Connection } from "../../connection";
import { useFunctionalTestCase } from "./_helpers/functional-test-case";

describe("Functional/ResultTest", () => {
  const functional = useFunctionalTestCase();
  let connection: Connection;

  beforeEach(async () => {
    connection = functional.connection();
  });

  it.each([
    [
      "fetchNumeric",
      (result: Awaited<ReturnType<typeof connection.executeQuery>>) => result.fetchNumeric(),
      undefined,
    ],
    [
      "fetchAssociative",
      (result: Awaited<ReturnType<typeof connection.executeQuery>>) => result.fetchAssociative(),
      undefined,
    ],
    [
      "fetchOne",
      (result: Awaited<ReturnType<typeof connection.executeQuery>>) => result.fetchOne(),
      undefined,
    ],
    [
      "fetchAllNumeric",
      (result: Awaited<ReturnType<typeof connection.executeQuery>>) => result.fetchAllNumeric(),
      [],
    ],
    [
      "fetchAllAssociative",
      (result: Awaited<ReturnType<typeof connection.executeQuery>>) => result.fetchAllAssociative(),
      [],
    ],
    [
      "fetchFirstColumn",
      (result: Awaited<ReturnType<typeof connection.executeQuery>>) => result.fetchFirstColumn(),
      [],
    ],
  ])("handles freed result for %s()", async (_name, method, expected) => {
    const result = await connection.executeQuery(
      connection.getDatabasePlatform().getDummySelectSQL(),
    );
    result.free();

    expect(method(result)).toEqual(expected);
  });
});
