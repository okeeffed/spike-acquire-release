import { Result, ErrorType } from "./alt-result";
import { acquireRelease, AcquireReleaseError } from "./alt-acq";

describe("acquireRelease", () => {
  // Helper function to create a mock acquire function
  const mockAcquire = (success: boolean, value: any) =>
    jest.fn(() =>
      Promise.resolve(success ? Result.succeed(value) : Result.fail(value))
    );

  // Helper function to create a mock release function
  const mockRelease = (success: boolean, value: any) =>
    jest.fn(() =>
      Promise.resolve(success ? Result.succeed(value) : Result.fail(value))
    );

  it("should successfully acquire and provide a release function", async () => {
    const acquire = mockAcquire(true, "resource");
    const release = mockRelease(true, "released");

    const result = await acquireRelease(acquire, release);

    expect(result.isSuccess()).toBe(true);
    if (result.isSuccess()) {
      expect(result.data.resource).toBe("resource");
      expect(typeof result.data.release).toBe("function");

      const releaseResult = await result.data.release();
      expect(releaseResult.isSuccess()).toBe(true);
      if (releaseResult.isSuccess()) {
        expect(releaseResult.data).toBe("released");
      }
    }

    expect(acquire).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith("resource");
  });

  it("should handle acquire failure", async () => {
    const acquire = mockAcquire(false, {
      _tag: "AcquireError",
      message: "acquire error",
    });
    const release = mockRelease(true, "released");

    const result = await acquireRelease(acquire, release);

    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) {
      expect(result.error).toEqual({
        _tag: "AcquireError",
        message: "acquire error",
      });
    }

    expect(acquire).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
  });

  it("should handle rejected promises", async () => {
    const acquire = jest.fn(() =>
      Promise.reject(new Error("Unexpected error"))
    );
    const release = mockRelease(true, "released");

    const result = await acquireRelease(acquire, release);

    expect(result.isFailure()).toBe(true);
    if (result.isFailure()) {
      expect(result.error).toBeInstanceOf(AcquireReleaseError);
      expect(result.error.error.message).toBe("Unexpected error");
    }

    expect(acquire).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();
  });
});
