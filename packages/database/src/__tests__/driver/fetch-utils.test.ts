import { describe, expect, it } from "vitest";

import { ArrayResult } from "../../driver/array-result";
import { FetchUtils } from "../../driver/fetch-utils";

describe("FetchUtils parity helpers", () => {
  it("adds fetchAllAssociative and explicit fetch helpers", () => {
    const assocRows = FetchUtils.fetchAllAssociative(
      new ArrayResult([
        { id: 1, name: "Ada" },
        { id: 2, name: "Linus" },
      ]),
    );

    expect(assocRows).toEqual([
      { id: 1, name: "Ada" },
      { id: 2, name: "Linus" },
    ]);

    expect(FetchUtils.fetchAllNumeric(new ArrayResult([{ id: 1 }, { id: 2 }]))).toEqual([[1], [2]]);
    expect(FetchUtils.fetchFirstColumn(new ArrayResult([{ id: 10 }, { id: 20 }]))).toEqual([
      10, 20,
    ]);
    expect(FetchUtils.fetchOne(new ArrayResult([{ id: 99 }]))).toBe(99);
    expect(FetchUtils.fetchOne(new ArrayResult([]))).toBeUndefined();
  });
});
