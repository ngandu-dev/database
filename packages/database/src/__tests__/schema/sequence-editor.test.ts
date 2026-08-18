import { describe, expect, it } from "vitest";

import { InvalidSequenceDefinition } from "../../schema/exception/invalid-sequence-definition";
import { Sequence } from "../../schema/sequence";

describe("Schema/SequenceEditor (Doctrine parity)", () => {
  it("throws when name is not set", () => {
    const editor = Sequence.editor();

    expect(() => editor.create()).toThrow(InvalidSequenceDefinition);
  });

  it("throws on negative cache size", () => {
    const editor = Sequence.editor();

    expect(() => editor.setCacheSize(-1)).toThrow(InvalidSequenceDefinition);
  });
});
