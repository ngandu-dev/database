import type { SchemaException } from "../schema-exception";

export class NamespaceAlreadyExists extends Error implements SchemaException {
  constructor(message: string) {
    super(message);
    this.name = "NamespaceAlreadyExists";
  }

  public static new(namespaceName: string): NamespaceAlreadyExists {
    return new NamespaceAlreadyExists(`The namespace with name "${namespaceName}" already exists.`);
  }
}
