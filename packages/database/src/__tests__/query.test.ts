import { describe, expect, it } from "vitest";

import { ParameterType } from "../parameter-type";
import { Query } from "../query";

describe("Query", () => {
  it("exposes Doctrine-style getters", () => {
    const params = [1, "ada"];
    const types = [ParameterType.INTEGER, ParameterType.STRING];
    const query = new Query("SELECT * FROM users WHERE id = ? AND name = ?", params, types);

    expect(query.getSQL()).toBe("SELECT * FROM users WHERE id = ? AND name = ?");
    expect(query.getParams()).toBe(params);
    expect(query.getTypes()).toBe(types);
  });
});
