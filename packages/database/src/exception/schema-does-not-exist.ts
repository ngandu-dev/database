import { DatabaseObjectNotFoundException } from "./database-object-not-found-exception";

export class SchemaDoesNotExist extends DatabaseObjectNotFoundException {}
