import { InvalidArgumentException } from "./invalid-argument-exception";

export class DriverRequired extends InvalidArgumentException {
  public static new(url?: string | null): DriverRequired {
    if (url != null) {
      return new DriverRequired(
        'The options "driver" or "driverClass" are mandatory if a connection URL without scheme ' +
          `is given to DriverManager::getConnection(). Given URL "${url}".`,
      );
    }

    return new DriverRequired(
      'The options "driver" or "driverClass" are mandatory if no PDO instance is given to DriverManager::getConnection().',
    );
  }
}
