import { MatchType } from "../foreign-key-constraint/match-type";
import { ReferentialAction } from "../foreign-key-constraint/referential-action";

export class ForeignKeyConstraintColumnMetadataRow {
  private readonly id: number | string;

  constructor(
    private readonly referencingSchemaName: string | null,
    private readonly referencingTableName: string,
    id: number | string | null,
    private readonly name: string | null,
    private readonly referencedSchemaName: string | null,
    private readonly referencedTableName: string,
    private readonly matchType: MatchType,
    private readonly onUpdateAction: ReferentialAction,
    private readonly onDeleteAction: ReferentialAction,
    private readonly deferrable: boolean | null,
    private readonly deferred: boolean | null,
    private readonly referencingColumnName: string,
    private readonly referencedColumnName: string,
  ) {
    if (id !== null) {
      this.id = id;
    } else if (name !== null) {
      this.id = name;
    } else {
      throw new Error("Either the id or name must be set to a non-null value.");
    }
  }

  public getSchemaName(): string | null {
    return this.referencingSchemaName;
  }

  public getTableName(): string {
    return this.referencingTableName;
  }

  public getId(): number | string {
    return this.id;
  }

  public getName(): string | null {
    return this.name;
  }

  public getReferencedSchemaName(): string | null {
    return this.referencedSchemaName;
  }

  public getReferencedTableName(): string {
    return this.referencedTableName;
  }

  public getMatchType(): MatchType {
    return this.matchType;
  }

  public getOnUpdateAction(): ReferentialAction {
    return this.onUpdateAction;
  }

  public getOnDeleteAction(): ReferentialAction {
    return this.onDeleteAction;
  }

  public isDeferrable(): boolean {
    return this.deferrable === true;
  }

  public isDeferred(): boolean {
    return this.deferred === true;
  }

  public hasDeferrabilityInfo(): boolean {
    return this.deferrable !== null || this.deferred !== null;
  }

  public getReferencingColumnName(): string {
    return this.referencingColumnName;
  }

  public getReferencedColumnName(): string {
    return this.referencedColumnName;
  }
}
