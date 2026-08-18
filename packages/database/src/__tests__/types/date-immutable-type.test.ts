import { describe, expect, it } from "vitest";

import { ParameterType } from "../../parameter-type";
import { ConversionException } from "../../types/conversion-exception";
import { DateImmutableType } from "../../types/date-immutable-type";
import { createPlatformWithFormat } from "./_helpers/base-date-type-parity";

describe("DateImmutableType parity", () => {
  it("creates the correct type and binding", () => {
    const type = new DateImmutableType();
    expect(type).toBeInstanceOf(DateImmutableType);
    expect(type.getBindingType()).toBe(ParameterType.STRING);
  });

  it("converts Date instances to database values and null to null", () => {
    const type = new DateImmutableType();
    const platform = createPlatformWithFormat("getDateFormatString", "Y-m-d");

    expect(type.convertToDatabaseValue(new Date("2016-01-01T12:34:56Z"), platform)).toBeTypeOf(
      "string",
    );
    expect(type.convertToDatabaseValue(null, platform)).toBeNull();
  });

  it.skip(
    "rejects mutable DateTime inputs like Doctrine immutable types (JS Date has no mutable/immutable distinction)",
  );

  it("passes Date instances and null through for node conversion", () => {
    const type = new DateImmutableType();
    const platform = createPlatformWithFormat("getDateFormatString", "Y-m-d");
    const date = new Date();

    expect(type.convertToNodeValue(date, platform)).toBe(date);
    expect(type.convertToNodeValue(null, platform)).toBeNull();
  });

  it("converts date strings to Date values with zeroed time parts", () => {
    const date = new DateImmutableType().convertToNodeValue(
      "2016-01-01",
      createPlatformWithFormat("getDateFormatString", "Y-m-d"),
    );

    expect(date).toBeInstanceOf(Date);
    expect(date?.getFullYear()).toBe(2016);
    expect(date?.getHours()).toBe(0);
    expect(date?.getMinutes()).toBe(0);
    expect(date?.getSeconds()).toBe(0);
    expect(date?.getMilliseconds()).toBe(0);
  });

  it("throws on invalid date string conversion", () => {
    expect(() =>
      new DateImmutableType().convertToNodeValue(
        "invalid date string",
        createPlatformWithFormat("getDateFormatString", "Y-m-d"),
      ),
    ).toThrow(ConversionException);
  });
});
