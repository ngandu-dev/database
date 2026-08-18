import { describe, expect, it } from "vitest";

import { TypeAlreadyRegistered } from "../../../types/exception/type-already-registered";
import { StringType } from "../../../types/string-type";

describe("TypeAlreadyRegistered parity", () => {
  it("creates an informative message", () => {
    const exception = TypeAlreadyRegistered.new(new StringType());

    expect(exception.message).toContain("StringType");
    expect(exception.message.toLowerCase()).toContain("already registered");
  });
});
