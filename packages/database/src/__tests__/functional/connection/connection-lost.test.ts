import { describe, expect, it } from "vitest";

import { ConnectionLost } from "../../../exception/connection-lost";
import { AbstractMySQLPlatform } from "../../../platforms/abstract-mysql-platform";
import { useFunctionalTestCase } from "../_helpers/functional-test-case";

describe("Functional/Connection/ConnectionLostTest (Doctrine scope)", () => {
  const functional = useFunctionalTestCase();

  it("detects lost MySQL connections after session wait_timeout expires", async ({ skip }) => {
    const connection = functional.connection();
    const platform = connection.getDatabasePlatform();
    if (!(platform instanceof AbstractMySQLPlatform)) {
      skip();
    }

    // Node mysql2 tests use pools. Start a transaction to pin a physical session so the
    // wait_timeout change and the subsequent query target the same server connection.
    await connection.beginTransaction();
    await connection.executeStatement("SET SESSION wait_timeout=1");
    await sleep(2000);

    const query = platform.getDummySelectSQL();

    try {
      await connection.executeQuery(query);
    } catch (error) {
      expect(error).toBeInstanceOf(ConnectionLost);
      expect(await connection.fetchOne(query)).toBe(1);
      return;
    }

    expect.fail("The connection should have lost");
  });
});

async function sleep(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
