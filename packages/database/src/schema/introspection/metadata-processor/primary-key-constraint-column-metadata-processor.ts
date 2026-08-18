import { PrimaryKeyConstraintColumnRow } from "../../metadata/primary-key-constraint-column-row";
import { UnqualifiedName } from "../../name/unqualified-name";
import { PrimaryKeyConstraint } from "../../primary-key-constraint";
import { PrimaryKeyConstraintEditor } from "../../primary-key-constraint-editor";

export class PrimaryKeyConstraintColumnMetadataProcessor {
  public initializeEditor(row: PrimaryKeyConstraintColumnRow): PrimaryKeyConstraintEditor {
    return PrimaryKeyConstraint.editor().setIsClustered(row.isClustered());
  }

  public applyRow(editor: PrimaryKeyConstraintEditor, row: PrimaryKeyConstraintColumnRow): void {
    editor.addColumnName(UnqualifiedName.quoted(row.getColumnName()));
  }
}
