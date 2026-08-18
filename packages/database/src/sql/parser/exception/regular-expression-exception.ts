import { Exception } from "../exception";

export class RegularExpressionException extends Exception {
  constructor(message: string, code: number) {
    super(message);
    this.name = "RegularExpressionException";
    Object.defineProperty(this, "code", {
      configurable: true,
      enumerable: false,
      value: code,
      writable: true,
    });
  }
}
