import { describe, expect, it } from "vitest";

import { ParameterType } from "../../parameter-type";
import { ConversionException } from "../../types/conversion-exception";
import { DateTimeTzImmutableType } from "../../types/date-time-tz-immutable-type";
import { createPlatformWithFormat } from "./_helpers/base-date-type-parity";

describe("DateTimeTzImmutableType parity", () => {
  it("creates the correct type and binding", () => {
    const type = new DateTimeTzImmutableType();
    expect(type).toBeInstanceOf(DateTimeTzImmutableType);
    expect(type.getBindingType()).toBe(ParameterType.STRING);
  });

  it("converts Date instances to database values (Node-adapted timezone format using P)", () => {
    const type = new DateTimeTzImmutableType();
    const platform = createPlatformWithFormat("getDateTimeTzFormatString", "Y-m-d H:i:s P");

    const value = type.convertToDatabaseValue(new Date("2016-01-01T15:58:59Z"), platform);
    expect(value).toBeTypeOf("string");
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+-]\d{2}:\d{2}$/);
  });

  it("converts null to/from null", () => {
    const type = new DateTimeTzImmutableType();
    const platform = createPlatformWithFormat("getDateTimeTzFormatString", "Y-m-d H:i:s P");

    expect(type.convertToDatabaseValue(null, platform)).toBeNull();
    expect(type.convertToNodeValue(null, platform)).toBeNull();
  });

  it.skip(
    "rejects mutable DateTime inputs like Doctrine immutable types (JS Date has no mutable/immutable distinction)",
  );

  it("passes Date instances through for node conversion", () => {
    const date = new Date();
    expect(
      new DateTimeTzImmutableType().convertToNodeValue(
        date,
        createPlatformWithFormat("getDateTimeTzFormatString", "Y-m-d H:i:s P"),
      ),
    ).toBe(date);
  });

  it("converts datetime-with-timezone strings to Date values (Node-adapted +00:00 format)", () => {
    const date = new DateTimeTzImmutableType().convertToNodeValue(
      "2016-01-01 15:58:59 +00:00",
      createPlatformWithFormat("getDateTimeTzFormatString", "Y-m-d H:i:s P"),
    );

    expect(date).toBeInstanceOf(Date);
    expect(date?.toISOString()).toBe("2016-01-01T15:58:59.000Z");
  });

  it("throws on invalid datetime-with-timezone strings", () => {
    expect(() =>
      new DateTimeTzImmutableType().convertToNodeValue(
        "invalid datetime with timezone string",
        createPlatformWithFormat("getDateTimeTzFormatString", "Y-m-d H:i:s P"),
      ),
    ).toThrow(ConversionException);
  });
});
