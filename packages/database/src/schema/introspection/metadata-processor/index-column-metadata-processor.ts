import { Index } from "../../index";
import { IndexedColumn } from "../../index/indexed-column";
import { IndexEditor } from "../../index-editor";
import { IndexColumnMetadataRow } from "../../metadata/index-column-metadata-row";
import { Parsers } from "../../name/parsers";

export class IndexColumnMetadataProcessor {
  public initializeEditor(row: IndexColumnMetadataRow): IndexEditor {
    const parser = Parsers.getUnqualifiedNameParser();

    return Index.editor()
      .setName(parser.parse(row.getIndexName()).toString())
      .setType(row.getType())
      .setIsClustered(row.isClustered())
      .setPredicate(row.getPredicate());
  }

  public applyRow(editor: IndexEditor, row: IndexColumnMetadataRow): void {
    const parser = Parsers.getUnqualifiedNameParser();

    editor.addColumn(new IndexedColumn(parser.parse(row.getColumnName()), row.getColumnLength()));
  }
}
