export interface NamedObject<TName = string> {
  getObjectName(): TName;
}
