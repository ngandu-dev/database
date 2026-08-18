import { describe, expect, it } from "vitest";

import { DataSourceName } from "../../../driver/db2/data-source-name";

describe("DB2 DataSourceName (Doctrine parity)", () => {
  it.each([
    [[], ""],
    [
      {
        dbname: "doctrine",
        host: "localhost",
        password: "Passw0rd",
        port: 50000,
        user: "db2inst1",
      },
      "HOSTNAME=localhost;PORT=50000;DATABASE=doctrine;UID=db2inst1;PWD=Passw0rd",
    ],
    [
      {
        dbname: "HOSTNAME=localhost;PORT=50000;DATABASE=doctrine;UID=db2inst1;PWD=Passw0rd",
      },
      "HOSTNAME=localhost;PORT=50000;DATABASE=doctrine;UID=db2inst1;PWD=Passw0rd",
    ],
  ])("builds DSN from connection parameters %#", (params, expected) => {
    expect(DataSourceName.fromConnectionParameters(params).toString()).toBe(expected);
  });
});
