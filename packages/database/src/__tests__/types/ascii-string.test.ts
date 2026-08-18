import { describe, expect, it, vi } from "vitest";

import { ParameterType } from "../../parameter-type";
import { MySQLPlatform } from "../../platforms/mysql-platform";
import { AsciiStringType } from "../../types/ascii-string-type";

describe("AsciiStringType parity", () => {
  it("returns the ASCII binding type", () => {
    expect(new AsciiStringType().getBindingType()).toBe(ParameterType.ASCII);
  });

  it.each([
    [{ length: 12, fixed: true }],
    [{ length: 14 }],
  ])("delegates SQL declaration to the platform (%p)", (column) => {
    const platform = new MySQLPlatform();
    const type = new AsciiStringType();
    const spy = vi
      .spyOn(platform, "getAsciiStringTypeDeclarationSQL")
      .mockReturnValue("TEST_ASCII");

    type.getSQLDeclaration(column, platform);

    expect(spy).toHaveBeenCalledWith(column);
  });
});
