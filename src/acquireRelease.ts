import { Failure, Result, fail, succeed } from "./result";

type AcquireRelease<A, E = unknown, R = void> = {
  resource: A;
  release: () => Promise<Result<R, E>>;
};

/**
 * Rejected values are treated like defects and not handled in this function.
 * They are thrown as exceptions.
 */
export function acquireRelease<T, E = Error, R = unknown>(
  acquire: () => Promise<Result<T, E>>,
  release: (resource: T) => Promise<Result<R, E>>
): Promise<AcquireRelease<T, E, R>> {
  return new Promise((resolve) => {
    acquire().then((acquireResult) => {
      if (acquireResult._tag === "Failure") {
        // If the acquire operation fails, we return a no-op release function
        resolve({
          resource: null as any,
          release: () => Promise.resolve(fail(acquireResult.error)),
        });
      } else {
        resolve({
          resource: acquireResult.data,
          release: () => {
            return release(acquireResult.data);
          },
        });
      }
    });
  });
}
