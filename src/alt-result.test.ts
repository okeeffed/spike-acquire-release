import { Result, ErrorType } from "./alt-result";

describe("Result", () => {
  // Define some test error types
  type TestError =
    | { _tag: "TestError1"; message: string }
    | { _tag: "TestError2"; message: string };

  describe("creation and basic methods", () => {
    it("should create a Success result", () => {
      const result = Result.succeed(42);
      expect(result.isSuccess()).toBe(true);
      expect(result.isFailure()).toBe(false);
      expect(result.data).toBe(42);
    });

    it("should create a Failure result", () => {
      const error: TestError = { _tag: "TestError1", message: "Test error" };
      const result = Result.fail(error);
      expect(result.isSuccess()).toBe(false);
      expect(result.isFailure()).toBe(true);
      expect(result.error).toEqual(error);
    });

    it("should throw when accessing data of a Failure", () => {
      const result = Result.fail({ _tag: "TestError1", message: "Test error" });
      expect(() => result.data).toThrow("Cannot get data from a Failure");
    });

    it("should throw when accessing error of a Success", () => {
      const result = Result.succeed(42);
      expect(() => result.error).toThrow("Cannot get error from a Success");
    });
  });

  describe("map and flatMap", () => {
    it("should map a Success result", () => {
      const result = Result.succeed(42).map((x) => x * 2);
      expect(result.isSuccess()).toBe(true);
      expect(result.data).toBe(84);
    });

    it("should not map a Failure result", () => {
      const error: TestError = { _tag: "TestError1", message: "Test error" };
      const result = Result.fail<TestError>(error).map((x) => x * 2);
      expect(result.isFailure()).toBe(true);
      expect(result.error).toEqual(error);
    });

    it("should flatMap a Success result", () => {
      const result = Result.succeed(42).flatMap((x) => Result.succeed(x * 2));
      expect(result.isSuccess()).toBe(true);
      expect(result.data).toBe(84);
    });

    it("should not flatMap a Failure result", () => {
      const error: TestError = { _tag: "TestError1", message: "Test error" };
      const result = Result.fail<TestError>(error).flatMap((x) =>
        Result.succeed(x * 2)
      );
      expect(result.isFailure()).toBe(true);
      expect(result.error).toEqual(error);
    });
  });

  describe("equals", () => {
    it("should consider two Success results with the same data equal", () => {
      const result1 = Result.succeed(42);
      const result2 = Result.succeed(42);
      expect(result1.equals(result2)).toBe(true);
    });

    it("should consider two Failure results with the same error equal", () => {
      const error: TestError = { _tag: "TestError1", message: "Test error" };
      const result1 = Result.fail(error);
      const result2 = Result.fail(error);
      expect(result1.equals(result2)).toBe(true);
    });

    it("should consider Success and Failure results not equal", () => {
      const success = Result.succeed(42);
      const failure = Result.fail({
        _tag: "TestError1",
        message: "Test error",
      });
      expect(success.equals(failure)).toBe(false);
    });
  });

  describe("matchTag", () => {
    it("should match Success case", () => {
      const result = Result.succeed(42);
      const output = Result.matchTag(result as Result<number, TestError>, {
        Success: (data) => `Success: ${data}`,
        TestError1: (error: TestError) => `Error1: ${error.message}`,
        TestError2: (error: TestError) => `Error2: ${error.message}`,
      });
      expect(output).toBe("Success: 42");
    });

    it("should match Failure case", () => {
      const result = Result.fail<TestError>({
        _tag: "TestError1",
        message: "Test error",
      });
      const output = Result.matchTag(result, {
        Success: (data) => `Success: ${data}`,
        TestError1: (error: TestError) => `Error1: ${error.message}`,
        TestError2: (error: TestError) => `Error2: ${error.message}`,
      });
      expect(output).toBe("Error1: Test error");
    });

    it("should throw for unhandled error types", () => {
      const result = Result.fail({ _tag: "UnhandledError" } as ErrorType);
      expect(() =>
        Result.matchTag(result as unknown as Result<number, TestError>, {
          Success: (data) => `Success: ${data}`,
          TestError1: (error: TestError) => `Error1: ${error.message}`,
          TestError2: (error: TestError) => `Error2: ${error.message}`,
        })
      ).toThrow("Unhandled error type: UnhandledError");
    });
  });
});
