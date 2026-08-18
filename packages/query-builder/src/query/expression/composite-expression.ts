export class CompositeExpression {
  public static readonly TYPE_AND = "AND";
  public static readonly TYPE_OR = "OR";

  private readonly parts: (CompositeExpression | string)[];

  constructor(
    private readonly type: "AND" | "OR",
    part: CompositeExpression | string,
    ...rest: (CompositeExpression | string)[]
  ) {
    this.parts = [part, ...rest];
  }

  public static and(
    part: CompositeExpression | string,
    ...parts: (CompositeExpression | string)[]
  ): CompositeExpression {
    return new CompositeExpression("AND", part, ...parts);
  }

  public static or(
    part: CompositeExpression | string,
    ...parts: (CompositeExpression | string)[]
  ): CompositeExpression {
    return new CompositeExpression("OR", part, ...parts);
  }

  public with(
    part: CompositeExpression | string,
    ...parts: (CompositeExpression | string)[]
  ): CompositeExpression {
    const newParts = [...this.parts, part, ...parts].filter(
      (p): p is CompositeExpression | string => p !== undefined,
    );
    if (newParts.length === 0) {
      throw new Error("CompositeExpression.with() requires at least one part");
    }
    const [first, ...restParts] = newParts;
    if (first === undefined) {
      throw new Error("CompositeExpression.with() requires at least one valid part");
    }

    return new CompositeExpression(this.type, first, ...restParts);
  }

  public getType(): "AND" | "OR" {
    return this.type;
  }

  public count(): number {
    return this.parts.length;
  }

  public toString(): string {
    if (this.parts.length === 1) {
      return String(this.parts[0]);
    }
    return `(${this.parts.map(String).join(`) ${this.type} (`)})`;
  }
}
