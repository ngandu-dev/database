import { describe, expect, it } from "vitest";

import { Identifier } from "../../schema/identifier";
import { Identifier as NameIdentifier } from "../../schema/name/identifier";

describe("Schema/Identifier (Doctrine parity)", () => {
  it("parses a generic object name into identifiers", () => {
    const identifier = new Identifier("warehouse.inventory.products.id");
    const name = identifier.getObjectName();

    expect(name.getIdentifiers()).toEqual([
      NameIdentifier.unquoted("warehouse"),
      NameIdentifier.unquoted("inventory"),
      NameIdentifier.unquoted("products"),
      NameIdentifier.unquoted("id"),
    ]);
  });
});
