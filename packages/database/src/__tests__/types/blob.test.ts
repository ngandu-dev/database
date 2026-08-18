import { describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { BlobType } from "../../types/blob-type";

describe("BlobType parity", () => {
  it("converts null database values to null", () => {
    expect(new BlobType().convertToNodeValue(null, new MySQLPlatform())).toBeNull();
  });
});
