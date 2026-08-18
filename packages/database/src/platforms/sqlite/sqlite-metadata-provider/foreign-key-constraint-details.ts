export class ForeignKeyConstraintDetails {
  public constructor(
    private readonly name: string | null,
    private readonly deferrable: boolean,
    private readonly deferred: boolean,
  ) {}

  public getName(): string | null {
    return this.name;
  }

  public isDeferrable(): boolean {
    return this.deferrable;
  }

  public isDeferred(): boolean {
    return this.deferred;
  }
}
