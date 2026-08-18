export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export class ConsoleLogger implements Logger {
  constructor(
    private readonly output: Pick<Console, "debug" | "error" | "info" | "warn"> = console,
  ) {}

  public debug(message: string, context?: Record<string, unknown>): void {
    if (context === undefined) {
      this.output.debug(message);
      return;
    }

    this.output.debug(message, context);
  }

  public info(message: string, context?: Record<string, unknown>): void {
    if (context === undefined) {
      this.output.info(message);
      return;
    }

    this.output.info(message, context);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    if (context === undefined) {
      this.output.warn(message);
      return;
    }

    this.output.warn(message, context);
  }

  public error(message: string, context?: Record<string, unknown>): void {
    if (context === undefined) {
      this.output.error(message);
      return;
    }

    this.output.error(message, context);
  }
}
