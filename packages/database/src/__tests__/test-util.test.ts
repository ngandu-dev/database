import { describe, expect, it } from "vitest";

import { SQLitePlatform } from "../platforms/sqlite-platform";
import { TestUtil } from "./test-util";

describe("TestUtil", () => {
  it("generates a union-all dummy select query for rows", () => {
    const platform = new SQLitePlatform();

    const sql = TestUtil.generateResultSetQuery(
      ["a", "b"],
      [
        ["foo", 1],
        ["bar", 2],
      ],
      platform,
    );

    expect(sql).toContain("UNION ALL");
    expect(sql).toContain("'foo'");
    expect(sql).toContain("'bar'");
    expect(sql).toContain(platform.quoteSingleIdentifier("a"));
    expect(sql).toContain(platform.quoteSingleIdentifier("b"));
  });

  it("quotes string values and stringifies non-string values", () => {
    const platform = new SQLitePlatform();

    const sql = TestUtil.generateResultSetQuery(["s", "n", "b"], [["x", 42, true]], platform);

    expect(sql).toContain("'x'");
    expect(sql).toContain(`42 ${platform.quoteSingleIdentifier("n")}`);
    expect(sql).toContain(`true ${platform.quoteSingleIdentifier("b")}`);
  });
});
