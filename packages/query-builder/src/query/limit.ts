export class Limit {
  constructor(
    public readonly maxResults: number | null,
    public readonly firstResult: number = 0,
  ) {}

  public isDefined(): boolean {
    return this.maxResults !== null || this.firstResult !== 0;
  }

  public getMaxResults(): number | null {
    return this.maxResults;
  }

  public getFirstResult(): number {
    return this.firstResult;
  }
}
