import { describe, expect, it } from "vitest";

import { EasyConnectString } from "../../../driver/abstract-oracle-driver/easy-connect-string";

describe("EasyConnectString", () => {
  it("renders nested array parameters", () => {
    const easyConnect = EasyConnectString.fromArray({
      DESCRIPTION: {
        ADDRESS: {
          PROTOCOL: "TCP",
          HOST: "db.example.test",
          PORT: 1521,
        },
        CONNECT_DATA: {
          SID: "XE",
          EMPTY_VALUE: null,
          ENABLED: true,
          DISABLED: false,
        },
      },
    });

    expect(easyConnect.toString()).toBe(
      "(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=db.example.test)(PORT=1521))(CONNECT_DATA=(SID=XE)(ENABLED=1)))",
    );
  });

  it("uses connectstring when provided", () => {
    const easyConnect = EasyConnectString.fromConnectionParameters({
      connectstring: "(DESCRIPTION=(ADDRESS=(HOST=override)))",
      host: "ignored",
      dbname: "ignored",
    });

    expect(easyConnect.toString()).toBe("(DESCRIPTION=(ADDRESS=(HOST=override)))");
  });

  it("falls back to dbname when host is missing", () => {
    expect(EasyConnectString.fromConnectionParameters({ dbname: "XE" }).toString()).toBe("XE");
    expect(EasyConnectString.fromConnectionParameters({}).toString()).toBe("");
  });

  it("builds an oracle descriptor using SID by default", () => {
    const easyConnect = EasyConnectString.fromConnectionParameters({
      host: "oracle.local",
      dbname: "ORCL",
    });

    expect(easyConnect.toString()).toBe(
      "(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=oracle.local)(PORT=1521))(CONNECT_DATA=(SID=ORCL)))",
    );
  });
});
