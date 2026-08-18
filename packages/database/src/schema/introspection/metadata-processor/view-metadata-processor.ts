import { ViewMetadataRow } from "../../metadata/view-metadata-row";
import { View } from "../../view";

export class ViewMetadataProcessor {
  public createObject(row: ViewMetadataRow): View {
    return View.editor()
      .setQuotedName(row.getViewName(), row.getSchemaName())
      .setSQL(row.getDefinition())
      .create();
  }
}
