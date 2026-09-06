/**
 * Application-level error carrying an HTTP status. Thrown by services and
 * translated to a JSON response by the global error handler.
 */
export class AppError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}
