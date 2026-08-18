import { describe, expect, it } from "vitest";

import { InvalidIndexDefinition } from "../../../schema/exception/invalid-index-definition";
import { IndexedColumn } from "../../../schema/index/indexed-column";
import { UnqualifiedName } from "../../../schema/name/unqualified-name";

describe("Schema/Index/IndexedColumn (Doctrine parity)", () => {
  it("rejects non-positive column length", () => {
    expect(() => new IndexedColumn(UnqualifiedName.unquoted("id"), -1)).toThrow(
      InvalidIndexDefinition,
    );
  });
});
