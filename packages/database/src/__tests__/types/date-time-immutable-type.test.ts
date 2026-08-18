import { describe, expect, it } from "vitest";

import { ParameterType } from "../../parameter-type";
import { ConversionException } from "../../types/conversion-exception";
import { DateTimeImmutableType } from "../../types/date-time-immutable-type";
import { createPlatformWithFormat } from "./_helpers/base-date-type-parity";

describe("DateTimeImmutableType parity", () => {
  it("creates the correct type and binding", () => {
    const type = new DateTimeImmutableType();
    expect(type).toBeInstanceOf(DateTimeImmutableType);
    expect(type.getBindingType()).toBe(ParameterType.STRING);
  });

  it("converts Date instances and null to database values", () => {
    const type = new DateTimeImmutableType();
    const platform = createPlatformWithFormat("getDateTimeFormatString", "Y-m-d H:i:s");

    expect(type.convertToDatabaseValue(new Date("2016-01-01T15:58:59Z"), platform)).toBeTypeOf(
      "string",
    );
    expect(type.convertToDatabaseValue(null, platform)).toBeNull();
  });

  it.skip(
    "rejects mutable DateTime inputs like Doctrine immutable types (JS Date has no mutable/immutable distinction)",
  );

  it("passes Date instances and null through for node conversion", () => {
    const type = new DateTimeImmutableType();
    const platform = createPlatformWithFormat("getDateTimeFormatString", "Y-m-d H:i:s");
    const date = new Date();

    expect(type.convertToNodeValue(date, platform)).toBe(date);
    expect(type.convertToNodeValue(null, platform)).toBeNull();
  });

  it("converts datetime strings to Date values", () => {
    const date = new DateTimeImmutableType().convertToNodeValue(
      "2016-01-01 15:58:59",
      createPlatformWithFormat("getDateTimeFormatString", "Y-m-d H:i:s"),
    );

    expect(date).toBeInstanceOf(Date);
  });

  it("converts datetime strings with microseconds to Date values (ms precision in JS)", () => {
    const date = new DateTimeImmutableType().convertToNodeValue(
      "2016-01-01 15:58:59.123456",
      createPlatformWithFormat("getDateTimeFormatString", "Y-m-d H:i:s"),
    );

    expect(date).toBeInstanceOf(Date);
    expect(date?.getMilliseconds()).toBe(123);
  });

  it("throws on invalid datetime strings", () => {
    expect(() =>
      new DateTimeImmutableType().convertToNodeValue(
        "invalid datetime string",
        createPlatformWithFormat("getDateTimeFormatString", "Y-m-d H:i:s"),
      ),
    ).toThrow(ConversionException);
  });
});
