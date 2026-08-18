import { describe, expect, it } from "vitest";

import { ConversionException } from "../../types/conversion-exception";
import { TimeType } from "../../types/time-type";
import {
  createPlatformWithFormat,
  runBaseDateTypeParitySuite,
} from "./_helpers/base-date-type-parity";

describe("TimeType parity", () => {
  runBaseDateTypeParitySuite({
    createType: () => new TimeType(),
    formatMethod: "getTimeFormatString",
    format: "H:i:s",
    label: "TimeType",
  });

  it("converts time strings to Date values", () => {
    const date = new TimeType().convertToNodeValue(
      "05:30:55",
      createPlatformWithFormat("getTimeFormatString", "H:i:s"),
    );

    expect(date).toBeInstanceOf(Date);
  });

  it("resets the date fields to the Unix epoch date", () => {
    const date = new TimeType().convertToNodeValue(
      "01:23:34",
      createPlatformWithFormat("getTimeFormatString", "H:i:s"),
    );

    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(1970);
    expect(date!.getMonth()).toBe(0);
    expect(date!.getDate()).toBe(1);
    expect(date!.getHours()).toBe(1);
    expect(date!.getMinutes()).toBe(23);
    expect(date!.getSeconds()).toBe(34);
  });

  it("throws on invalid time format conversion", () => {
    expect(() =>
      new TimeType().convertToNodeValue(
        "abcdefg",
        createPlatformWithFormat("getTimeFormatString", "H:i:s"),
      ),
    ).toThrow(ConversionException);
  });
});
