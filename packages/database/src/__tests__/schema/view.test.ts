import { describe, expect, it } from "vitest";

import { Identifier as NameIdentifier } from "../../schema/name/identifier";
import { View } from "../../schema/view";

describe("Schema/View (Doctrine parity)", () => {
  it("parses unqualified object names", () => {
    const view = new View("active_users", "SELECT 1");
    const name = view.getObjectName();

    expect(name.getUnqualifiedName()).toEqual(NameIdentifier.unquoted("active_users"));
    expect(name.getQualifier()).toBeNull();
  });

  it("parses qualified object names", () => {
    const view = new View("inventory.available_products", "SELECT 1");
    const name = view.getObjectName();

    expect(name.getUnqualifiedName()).toEqual(NameIdentifier.unquoted("available_products"));
    expect(name.getQualifier()).toEqual(NameIdentifier.unquoted("inventory"));
  });
});
