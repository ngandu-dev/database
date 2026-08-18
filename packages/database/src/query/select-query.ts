import { ForUpdate } from "./for-update";
import { Limit } from "./limit";

export class SelectQuery {
  constructor(
    public readonly distinct: boolean,
    public readonly columns: string[],
    public readonly from: string[],
    public readonly where: string | null,
    public readonly groupBy: string[],
    public readonly having: string | null,
    public readonly orderBy: string[],
    public readonly limit: Limit,
    public readonly forUpdate: ForUpdate | null,
  ) {}

  public isDistinct(): boolean {
    return this.distinct;
  }

  public getColumns(): string[] {
    return [...this.columns];
  }

  public getFrom(): string[] {
    return [...this.from];
  }

  public getWhere(): string | null {
    return this.where;
  }

  public getGroupBy(): string[] {
    return [...this.groupBy];
  }

  public getHaving(): string | null {
    return this.having;
  }

  public getOrderBy(): string[] {
    return [...this.orderBy];
  }

  public getLimit(): Limit {
    return this.limit;
  }

  public getForUpdate(): ForUpdate | null {
    return this.forUpdate;
  }
}
