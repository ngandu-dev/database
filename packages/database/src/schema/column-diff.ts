import { Column } from "./column";

export class ColumnDiff {
  constructor(
    public readonly oldColumn: Column,
    public readonly newColumn: Column,
    public readonly changedProperties: readonly string[],
  ) {}

  public hasChanges(): boolean {
    return this.changedProperties.length > 0;
  }

  public countChangedProperties(): number {
    return (
      Number(this.hasUnsignedChanged()) +
      Number(this.hasAutoIncrementChanged()) +
      Number(this.hasDefaultChanged()) +
      Number(this.hasFixedChanged()) +
      Number(this.hasPrecisionChanged()) +
      Number(this.hasScaleChanged()) +
      Number(this.hasLengthChanged()) +
      Number(this.hasNotNullChanged()) +
      Number(this.hasNameChanged()) +
      Number(this.hasTypeChanged()) +
      Number(this.hasPlatformOptionsChanged()) +
      Number(this.hasCommentChanged())
    );
  }

  public getOldColumn(): Column {
    return this.oldColumn;
  }

  public getNewColumn(): Column {
    return this.newColumn;
  }

  public hasNameChanged(): boolean {
    return this.oldColumn.getName().toLowerCase() !== this.newColumn.getName().toLowerCase();
  }

  public hasTypeChanged(): boolean {
    return this.oldColumn.getType().constructor !== this.newColumn.getType().constructor;
  }

  public hasLengthChanged(): boolean {
    return this.hasPropertyChanged((column) => column.getLength(), "length");
  }

  public hasPrecisionChanged(): boolean {
    return this.hasPropertyChanged((column) => column.getPrecision(), "precision");
  }

  public hasScaleChanged(): boolean {
    return this.hasPropertyChanged((column) => column.getScale(), "scale");
  }

  public hasUnsignedChanged(): boolean {
    return this.hasPropertyChanged((column) => column.getUnsigned(), "unsigned");
  }

  public hasFixedChanged(): boolean {
    return this.hasPropertyChanged((column) => column.getFixed(), "fixed");
  }

  public hasNotNullChanged(): boolean {
    return this.hasPropertyChanged((column) => column.getNotnull(), "notnull");
  }

  public hasDefaultChanged(): boolean {
    const oldDefault = this.oldColumn.getDefault();
    const newDefault = this.newColumn.getDefault();

    if ((oldDefault === null) !== (newDefault === null)) {
      return true;
    }

    return oldDefault !== newDefault || this.changedProperties.includes("default");
  }

  public hasAutoIncrementChanged(): boolean {
    return this.hasPropertyChanged((column) => column.getAutoincrement(), "autoincrement");
  }

  public hasCommentChanged(): boolean {
    return this.hasPropertyChanged((column) => column.getComment(), "comment");
  }

  public hasPlatformOptionsChanged(): boolean {
    const oldOptions = this.oldColumn.getPlatformOptions();
    const newOptions = this.newColumn.getPlatformOptions();

    return (
      JSON.stringify(oldOptions) !== JSON.stringify(newOptions) ||
      this.changedProperties.includes("platformOptions")
    );
  }

  private hasPropertyChanged<T>(property: (column: Column) => T, changedProperty: string): boolean {
    return (
      property(this.oldColumn) !== property(this.newColumn) ||
      this.changedProperties.includes(changedProperty)
    );
  }
}
