export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status; 0 when the backend could not be reached at all. */
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
