import { SequenceMetadataRow } from "../../metadata/sequence-metadata-row";
import { Sequence } from "../../sequence";

export class SequenceMetadataProcessor {
  public createObject(row: SequenceMetadataRow): Sequence {
    return Sequence.editor()
      .setQuotedName(row.getSequenceName(), row.getSchemaName())
      .setAllocationSize(row.getAllocationSize())
      .setInitialValue(row.getInitialValue())
      .setCacheSize(row.getCacheSize())
      .create();
  }
}
