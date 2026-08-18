import { Limit } from "./limit";
import { Union } from "./union";

export class UnionQuery {
  constructor(
    public readonly unionParts: Union[],
    public readonly orderBy: string[],
    public readonly limit: Limit,
  ) {}

  public getUnionParts(): Union[] {
    return [...this.unionParts];
  }

  public getOrderBy(): string[] {
    return [...this.orderBy];
  }

  public getLimit(): Limit {
    return this.limit;
  }
}
