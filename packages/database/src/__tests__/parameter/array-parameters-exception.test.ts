import { describe, expect, it } from "vitest";

import { MissingNamedParameter } from "../../array-parameters/exception/missing-named-parameter";
import { MissingPositionalParameter } from "../../array-parameters/exception/missing-positional-parameter";

describe("ArrayParameters exceptions parity", () => {
  it("creates MissingNamedParameter with Doctrine-compatible message", () => {
    const error = MissingNamedParameter.new("id");

    expect(error).toBeInstanceOf(MissingNamedParameter);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Named parameter "id" does not have a bound value.');
  });

  it("creates MissingPositionalParameter with Doctrine-compatible message", () => {
    const error = MissingPositionalParameter.new(2);

    expect(error).toBeInstanceOf(MissingPositionalParameter);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Positional parameter at index 2 does not have a bound value.");
  });
});
