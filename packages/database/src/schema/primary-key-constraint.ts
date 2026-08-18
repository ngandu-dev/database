import { InvalidPrimaryKeyConstraintDefinition } from "./exception/invalid-primary-key-constraint-definition";
import { PrimaryKeyConstraintEditor } from "./primary-key-constraint-editor";

export class PrimaryKeyConstraint {
  constructor(
    private readonly name: string | null,
    private readonly columnNames: string[],
    private readonly clustered: boolean,
  ) {
    if (this.columnNames.length === 0) {
      throw InvalidPrimaryKeyConstraintDefinition.columnNamesNotSet();
    }
  }

  public getObjectName(): string | null {
    return this.name;
  }

  public getColumnNames(): string[] {
    return [...this.columnNames];
  }

  public isClustered(): boolean {
    return this.clustered;
  }

  public static editor(): PrimaryKeyConstraintEditor {
    return new PrimaryKeyConstraintEditor();
  }

  public edit(): PrimaryKeyConstraintEditor {
    const editor = PrimaryKeyConstraint.editor();

    if (this.name !== null) {
      editor.setName(this.name);
    }

    return editor.setColumnNames(...this.columnNames).setIsClustered(this.clustered);
  }
}
