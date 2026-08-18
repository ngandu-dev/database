import { describe, expect, it } from "vitest";

import { InvalidPrimaryKeyConstraintDefinition } from "../../schema/exception/invalid-primary-key-constraint-definition";
import { PrimaryKeyConstraint } from "../../schema/primary-key-constraint";

describe("Schema/PrimaryKeyConstraint (Doctrine parity)", () => {
  it("throws on empty column names", () => {
    expect(() => new PrimaryKeyConstraint(null, [], false)).toThrow(
      InvalidPrimaryKeyConstraintDefinition,
    );
  });
});
