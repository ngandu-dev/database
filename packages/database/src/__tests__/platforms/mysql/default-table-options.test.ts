import { describe, expect, it } from "vitest";

import { DefaultTableOptions } from "../../../platforms/mysql/default-table-options";

describe("MySQL DefaultTableOptions", () => {
  it("exposes charset and collation", () => {
    const options = new DefaultTableOptions("utf8mb4", "utf8mb4_general_ci");

    expect(options.getCharset()).toBe("utf8mb4");
    expect(options.getCollation()).toBe("utf8mb4_general_ci");
  });
});
