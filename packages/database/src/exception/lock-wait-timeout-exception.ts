import type { RetryableException } from "./retryable-exception";
import { ServerException } from "./server-exception";

export class LockWaitTimeoutException extends ServerException implements RetryableException {}
