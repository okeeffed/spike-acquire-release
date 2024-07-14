import { Result, ErrorType } from "./alt-result";

type AcquireRelease<A, E extends ErrorType, R = void> = {
  resource: A;
  release: () => Promise<Result<R, E>>;
};

export class AcquireReleaseError {
  readonly _tag = "AcquireReleaseError";
  readonly error: Error;

  constructor(error: Error) {
    this.error = error;
  }
}

/**
 * Acquires a resource and provides a function to release it.
 *
 * @template T The type of the resource to be acquired.
 * @template E The type of error that might occur during acquire or release (default: Error).
 * @template R The type of the result returned by the release function (default: unknown).
 *
 * @param acquire A function that returns a Promise resolving to a Result containing the resource or an error.
 * @param release A function that takes the acquired resource and returns a Promise resolving to a Result of the release operation.
 *
 * @returns A Promise resolving to a Result containing either an AcquireRelease object or an error.
 *
 * @remarks
 * The R type parameter represents the result type of the release operation.
 * It's set to 'unknown' by default, allowing the release operation to potentially return any type.
 * This can be useful if the release operation needs to return some specific information or status.
 *
 * Rejected promises are treated as defects and not handled in this function.
 * They are thrown as exceptions.
 */
export async function acquireRelease<T, E extends ErrorType, R = unknown>(
  acquire: () => Promise<Result<T, E>>,
  release: (resource: T) => Promise<Result<R, E>>
): Promise<Result<AcquireRelease<T, E, R>, E | AcquireReleaseError>> {
  try {
    const acquireResult = await acquire();

    if (acquireResult.isFailure()) {
      return Result.fail(acquireResult.error);
    }

    const resource = acquireResult.data;

    return Result.succeed({
      resource,
      release: () => release(resource),
    });
  } catch (err) {
    return Result.fail(
      new AcquireReleaseError(
        err instanceof Error ? err : new Error(String(err))
      )
    );
  }
}
