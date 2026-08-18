import { describe, expect, it } from "vitest";

import { ConversionException } from "../../types/conversion-exception";
import { DateTimeType } from "../../types/date-time-type";
import {
  createPlatformWithFormat,
  runBaseDateTypeParitySuite,
} from "./_helpers/base-date-type-parity";

describe("DateTimeType parity", () => {
  runBaseDateTypeParitySuite({
    createType: () => new DateTimeType(),
    formatMethod: "getDateTimeFormatString",
    format: "Y-m-d H:i:s",
    label: "DateTimeType",
  });

  it("converts Date to database value using the platform format", () => {
    const type = new DateTimeType();
    const platform = createPlatformWithFormat("getDateTimeFormatString", "Y-m-d H:i:s");
    const date = new Date(1985, 8, 1, 10, 10, 10);

    const actual = type.convertToDatabaseValue(date, platform);
    expect(actual).toBeTypeOf("string");
    expect(actual).toMatch(/1985-09-01 10:10:10/);
  });

  it("converts datetime strings to Date values", () => {
    const date = new DateTimeType().convertToNodeValue(
      "1985-09-01 00:00:00",
      createPlatformWithFormat("getDateTimeFormatString", "Y-m-d H:i:s"),
    );

    expect(date).toBeInstanceOf(Date);
    expect(date?.getFullYear()).toBe(1985);
  });

  it("throws on invalid datetime format conversion", () => {
    expect(() =>
      new DateTimeType().convertToNodeValue(
        "abcdefg",
        createPlatformWithFormat("getDateTimeFormatString", "Y-m-d H:i:s"),
      ),
    ).toThrow(ConversionException);
  });

  it("falls back to parser/date parsing for non-matching formats", () => {
    const date = new DateTimeType().convertToNodeValue(
      "1985/09/01 10:10:10.12345",
      createPlatformWithFormat("getDateTimeFormatString", "Y-m-d H:i:s"),
    );

    expect(date).toBeInstanceOf(Date);
  });
});
