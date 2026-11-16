import type { FormErrors } from "@agri/contracts";

export class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly fields?: FormErrors) {
    super(message);
  }
}
