import { describe, expect, it } from "vitest";

import { ConversionException } from "../../types/conversion-exception";
import { DateType } from "../../types/date-type";
import {
  createPlatformWithFormat,
  runBaseDateTypeParitySuite,
} from "./_helpers/base-date-type-parity";

describe("DateType parity", () => {
  runBaseDateTypeParitySuite({
    createType: () => new DateType(),
    formatMethod: "getDateFormatString",
    format: "Y-m-d",
    label: "DateType",
  });

  it("converts date strings to Date values", () => {
    const type = new DateType();
    const date = type.convertToNodeValue(
      "1985-09-01",
      createPlatformWithFormat("getDateFormatString", "Y-m-d"),
    );

    expect(date).toBeInstanceOf(Date);
  });

  it("resets non-date parts to zero", () => {
    const type = new DateType();
    const date = type.convertToNodeValue(
      "1985-09-01",
      createPlatformWithFormat("getDateFormatString", "Y-m-d"),
    );

    expect(date).not.toBeNull();
    expect(date!.getHours()).toBe(0);
    expect(date!.getMinutes()).toBe(0);
    expect(date!.getSeconds()).toBe(0);
  });

  it.skip(
    "preserves DST-specific midnight behavior exactly like Doctrine PHP DateTime across process TZ changes",
  );

  it("throws on invalid date format conversion", () => {
    expect(() =>
      new DateType().convertToNodeValue(
        "abcdefg",
        createPlatformWithFormat("getDateFormatString", "Y-m-d"),
      ),
    ).toThrow(ConversionException);
  });
});
