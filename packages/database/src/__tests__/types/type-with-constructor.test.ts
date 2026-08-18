import { describe, expect, it } from "vitest";

import { MySQLPlatform } from "../../platforms/mysql-platform";
import { TypeWithConstructor } from "./_helpers/type-with-constructor";

describe("TypeWithConstructor parity helper", () => {
  it("requires constructor arguments and stores them", () => {
    const type = new TypeWithConstructor(true);

    expect(type.requirement).toBe(true);
    expect(type.getSQLDeclaration({}, new MySQLPlatform())).toBe("");
  });
});
