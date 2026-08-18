import { describe, expect, it } from "vitest";

import { ParameterType } from "../../parameter-type";
import { ConversionException } from "../../types/conversion-exception";
import { TimeImmutableType } from "../../types/time-immutable-type";
import { createPlatformWithFormat } from "./_helpers/base-date-type-parity";

describe("TimeImmutableType parity", () => {
  it("creates the correct type and binding", () => {
    const type = new TimeImmutableType();
    expect(type).toBeInstanceOf(TimeImmutableType);
    expect(type.getBindingType()).toBe(ParameterType.STRING);
  });

  it("converts Date instances to database values and null to null", () => {
    const type = new TimeImmutableType();
    const platform = createPlatformWithFormat("getTimeFormatString", "H:i:s");

    expect(type.convertToDatabaseValue(new Date("2016-01-01T15:58:59Z"), platform)).toBeTypeOf(
      "string",
    );
    expect(type.convertToDatabaseValue(null, platform)).toBeNull();
  });

  it.skip(
    "rejects mutable DateTime inputs like Doctrine immutable types (JS Date has no mutable/immutable distinction)",
  );

  it("passes Date instances and null through for node conversion", () => {
    const type = new TimeImmutableType();
    const platform = createPlatformWithFormat("getTimeFormatString", "H:i:s");
    const date = new Date();

    expect(type.convertToNodeValue(date, platform)).toBe(date);
    expect(type.convertToNodeValue(null, platform)).toBeNull();
  });

  it("converts time strings to Date values and resets the date to epoch", () => {
    const date = new TimeImmutableType().convertToNodeValue(
      "15:58:59",
      createPlatformWithFormat("getTimeFormatString", "H:i:s"),
    );

    expect(date).toBeInstanceOf(Date);
    expect(date?.getFullYear()).toBe(1970);
    expect(date?.getMonth()).toBe(0);
    expect(date?.getDate()).toBe(1);
    expect(date?.getHours()).toBe(15);
    expect(date?.getMinutes()).toBe(58);
    expect(date?.getSeconds()).toBe(59);
  });

  it("throws on invalid time strings", () => {
    expect(() =>
      new TimeImmutableType().convertToNodeValue(
        "invalid time string",
        createPlatformWithFormat("getTimeFormatString", "H:i:s"),
      ),
    ).toThrow(ConversionException);
  });
});
