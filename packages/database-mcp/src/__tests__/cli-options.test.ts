import { describe, expect, it } from "vitest";

import { parseCliOptions } from "../cli/options";
import { DEFAULT_MAX_ROWS } from "../constants";

describe("parseCliOptions", () => {
  it("uses safe defaults", () => {
    expect(parseCliOptions([])).toEqual({
      databaseUrlEnv: "DATABASE_URL",
      defaultMaxRows: DEFAULT_MAX_ROWS,
      mode: "server",
    });
  });

  it("parses environment and row options", () => {
    expect(
      parseCliOptions(["--database-url-env", "REPORTING_URL", "--default-max-rows=75", "--check"]),
    ).toEqual({ databaseUrlEnv: "REPORTING_URL", defaultMaxRows: 75, mode: "check" });
  });

  it("rejects credentials on the command line", () => {
    expect(() => parseCliOptions(["--database-url=postgres://reader:secret@db/app"])).toThrow(
      "cannot be passed as command arguments",
    );
  });

  it("enforces the immutable row ceiling", () => {
    expect(() => parseCliOptions(["--default-max-rows", "1001"])).toThrow("between 1 and 1000");
  });
});
