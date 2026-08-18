import { describe, expect, it } from "vitest";

import { ParameterType } from "../../parameter-type";
import { ConversionException } from "../../types/conversion-exception";
import { VarDateTimeImmutableType } from "../../types/var-date-time-immutable-type";
import { createPlatformWithFormat } from "./_helpers/base-date-type-parity";

describe("VarDateTimeImmutableType parity", () => {
  it("returns the string binding type", () => {
    expect(new VarDateTimeImmutableType().getBindingType()).toBe(ParameterType.STRING);
  });

  it("converts Date values to database strings and null to null", () => {
    const type = new VarDateTimeImmutableType();
    const platform = createPlatformWithFormat("getDateTimeFormatString", "Y-m-d H:i:s");

    expect(type.convertToDatabaseValue(new Date("2016-01-01T15:58:59Z"), platform)).toBeTypeOf(
      "string",
    );
    expect(type.convertToDatabaseValue(null, platform)).toBeNull();
  });

  it.skip(
    "rejects mutable DateTime inputs like Doctrine immutable types (JS Date has no mutable/immutable distinction)",
  );

  it("converts date-ish strings to Date values (microseconds truncated to ms in JS)", () => {
    const date = new VarDateTimeImmutableType().convertToNodeValue(
      "2016-01-01 15:58:59.123456 UTC",
      createPlatformWithFormat("getDateTimeFormatString", "Y-m-d H:i:s"),
    );

    expect(date).toBeInstanceOf(Date);
    expect(date?.toISOString()).toBe("2016-01-01T15:58:59.123Z");
  });

  it("converts null and passes Date instances through", () => {
    const type = new VarDateTimeImmutableType();
    const platform = createPlatformWithFormat("getDateTimeFormatString", "Y-m-d H:i:s");
    const now = new Date();

    expect(type.convertToNodeValue(null, platform)).toBeNull();
    expect(type.convertToNodeValue(now, platform)).toBe(now);
  });

  it("throws on invalid date-ish strings", () => {
    expect(() =>
      new VarDateTimeImmutableType().convertToNodeValue(
        "invalid date-ish string",
        createPlatformWithFormat("getDateTimeFormatString", "Y-m-d H:i:s"),
      ),
    ).toThrow(ConversionException);
  });
});
