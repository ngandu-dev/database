import { empty, isPlainObject, isset, strval } from "../../_internal";

type EasyConnectParams = Record<string, unknown> | unknown[];

/**
 * Represents an Oracle Easy Connect string.
 *
 * @link https://docs.oracle.com/database/121/NETAG/naming.htm
 */
export class EasyConnectString {
  private constructor(private readonly value: string) {}

  public toString(): string {
    return this.value;
  }

  public static fromArray(params: Record<string, unknown>): EasyConnectString {
    return new EasyConnectString(EasyConnectString.renderParams(params));
  }

  public static fromConnectionParameters(params: Record<string, unknown>): EasyConnectString {
    const connectString = params.connectstring;
    if (isset(connectString)) {
      return new EasyConnectString(strval(connectString));
    }

    const host = params.host;
    if (!isset(host)) {
      const dbname = params.dbname;

      return new EasyConnectString(isset(dbname) ? strval(dbname) : "");
    }

    const connectData: Record<string, unknown> = {};

    if (isset(params.servicename) || isset(params.dbname)) {
      let serviceKey = "SID";

      if (isset(params.service) || isset(params.servicename)) {
        serviceKey = "SERVICE_NAME";
      }

      const serviceName = isset(params.servicename) ? params.servicename : params.dbname;

      connectData[serviceKey] = serviceName;
    }

    if (isset(params.instancename)) {
      connectData.INSTANCE_NAME = params.instancename;
    }

    if (!empty(params.pooled)) {
      connectData.SERVER = "POOLED";
    }

    const driverOptions = EasyConnectString.asRecord(params.driverOptions);
    const protocol = isset(driverOptions?.protocol) ? driverOptions?.protocol : "TCP";

    const port = isset(params.port) ? params.port : 1521;
    const address: Record<string, unknown> = {};
    address.PROTOCOL = protocol;
    address.HOST = host;
    address.PORT = port;

    return EasyConnectString.fromArray({
      DESCRIPTION: {
        ADDRESS: address,
        CONNECT_DATA: connectData,
      },
    });
  }

  private static renderParams(params: EasyConnectParams): string {
    const chunks: string[] = [];

    for (const [key, rawValue] of Object.entries(params)) {
      const renderedValue = EasyConnectString.renderValue(rawValue);

      if (renderedValue === "") {
        continue;
      }

      chunks.push(`(${key}=${renderedValue})`);
    }

    return chunks.join("");
  }

  private static renderValue(value: unknown): string {
    if (Array.isArray(value) || isPlainObject(value)) {
      return EasyConnectString.renderParams(value as EasyConnectParams);
    }

    return strval(value);
  }

  private static asRecord(value: unknown): Record<string, unknown> | null {
    if (!isPlainObject(value)) {
      return null;
    }

    return value;
  }
}
