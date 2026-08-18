import { describe, expect, it } from "vitest";

import { TypeNotRegistered } from "../../../types/exception/type-not-registered";
import { StringType } from "../../../types/string-type";

describe("TypeNotRegistered parity", () => {
  it("creates an informative message", () => {
    const exception = TypeNotRegistered.new(new StringType());

    expect(exception.message).toContain("StringType");
    expect(exception.message.toLowerCase()).toContain("not registered");
  });
});
