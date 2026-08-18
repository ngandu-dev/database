import { describe, expect, it } from "vitest";

import { Configuration } from "../configuration";

describe("Configuration", () => {
  it("defaults disableTypeComments to false and allows toggling it", () => {
    const configuration = new Configuration();

    expect(configuration.getDisableTypeComments()).toBe(false);
    expect(configuration.setDisableTypeComments(true)).toBe(configuration);
    expect(configuration.getDisableTypeComments()).toBe(true);
  });

  it("accepts disableTypeComments in constructor options", () => {
    const configuration = new Configuration({ disableTypeComments: true });

    expect(configuration.getDisableTypeComments()).toBe(true);
  });
});
