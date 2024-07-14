import { Result } from "./alt-result";
import { processUserData } from "./alt-main";
import { AcquireReleaseError } from "./alt-acq";

describe("processUserData", () => {
  const mockUserData = { name: "John Doe", email: "john@example.com" };
  const mockUserId = "123";
  const mockBucketName = "user-123-bucket";
  const mockRecordId = "record456";

  const mockCreateUserRecord = jest.fn();
  const mockCreateS3Bucket = jest.fn();
  const mockUploadRecordToS3 = jest.fn();
  const mockSendSQSMessage = jest.fn();
  const mockDeleteRecordFromS3 = jest.fn();
  const mockDeleteS3Bucket = jest.fn();
  const mockDeleteUserRecord = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockCreateUserRecord.mockResolvedValue(
      Result.succeed({ ...mockUserData, userId: mockUserId })
    );
    mockCreateS3Bucket.mockResolvedValue(
      Result.succeed({ bucketName: mockBucketName })
    );
    mockUploadRecordToS3.mockResolvedValue(
      Result.succeed({ recordId: mockRecordId })
    );
    mockSendSQSMessage.mockResolvedValue(
      Result.succeed({ message: "Message sent" })
    );
    mockDeleteRecordFromS3.mockResolvedValue(
      Result.succeed({ message: "Record deleted" })
    );
    mockDeleteS3Bucket.mockResolvedValue(
      Result.succeed({ message: "Bucket deleted" })
    );
    mockDeleteUserRecord.mockResolvedValue(
      Result.succeed({ message: "User deleted" })
    );
  });

  it("should successfully process user data without calling rollback functions", async () => {
    const result = await processUserData(
      mockUserData,
      mockCreateUserRecord,
      mockCreateS3Bucket,
      mockUploadRecordToS3,
      mockSendSQSMessage,
      mockDeleteRecordFromS3,
      mockDeleteS3Bucket,
      mockDeleteUserRecord
    );

    expect(result.isSuccess()).toBe(true);
    expect(mockDeleteUserRecord).not.toHaveBeenCalled();
    expect(mockDeleteS3Bucket).not.toHaveBeenCalled();
    expect(mockDeleteRecordFromS3).not.toHaveBeenCalled();
  });

  it("should handle failure in creating user record without calling any rollback functions", async () => {
    mockCreateUserRecord.mockResolvedValue(
      Result.fail(new AcquireReleaseError(new Error("Failed to create user")))
    );

    const result = await processUserData(
      mockUserData,
      mockCreateUserRecord,
      mockCreateS3Bucket,
      mockUploadRecordToS3,
      mockSendSQSMessage,
      mockDeleteRecordFromS3,
      mockDeleteS3Bucket,
      mockDeleteUserRecord
    );

    expect(result.isFailure()).toBe(true);
    expect(result.error).toHaveProperty("_tag", "RecordCreateError");
    expect(mockDeleteUserRecord).not.toHaveBeenCalled();
    expect(mockDeleteS3Bucket).not.toHaveBeenCalled();
    expect(mockDeleteRecordFromS3).not.toHaveBeenCalled();
  });

  it("should handle failure in creating S3 bucket and call user record rollback", async () => {
    mockCreateS3Bucket.mockResolvedValue(
      Result.fail(new AcquireReleaseError(new Error("Failed to create bucket")))
    );

    const result = await processUserData(
      mockUserData,
      mockCreateUserRecord,
      mockCreateS3Bucket,
      mockUploadRecordToS3,
      mockSendSQSMessage,
      mockDeleteRecordFromS3,
      mockDeleteS3Bucket,
      mockDeleteUserRecord
    );

    expect(result.isFailure()).toBe(true);
    expect(result.error).toHaveProperty("_tag", "S3Error");
    expect(result.error.rollbackFns).toHaveLength(1);

    // Call rollback and check if user record deletion was called
    await result.error.rollback();
    expect(mockDeleteUserRecord).toHaveBeenCalledWith(mockUserId);
    expect(mockDeleteS3Bucket).not.toHaveBeenCalled();
    expect(mockDeleteRecordFromS3).not.toHaveBeenCalled();
  });

  it("should handle failure in uploading record to S3 and call rollback functions in correct order", async () => {
    mockUploadRecordToS3.mockResolvedValue(
      Result.fail(new AcquireReleaseError(new Error("Failed to upload record")))
    );

    const result = await processUserData(
      mockUserData,
      mockCreateUserRecord,
      mockCreateS3Bucket,
      mockUploadRecordToS3,
      mockSendSQSMessage,
      mockDeleteRecordFromS3,
      mockDeleteS3Bucket,
      mockDeleteUserRecord
    );

    expect(result.isFailure()).toBe(true);
    expect(result.error).toHaveProperty("_tag", "S3Error");
    expect(result.error.rollbackFns).toHaveLength(2);

    // Call rollback and check if functions were called in the correct order
    await result.error.rollback();
    expect(mockDeleteS3Bucket).toHaveBeenCalledWith(mockBucketName);
    expect(mockDeleteUserRecord).toHaveBeenCalledWith(mockUserId);
    expect(mockDeleteRecordFromS3).not.toHaveBeenCalled();

    // Check the order of calls
    expect(mockDeleteS3Bucket.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteUserRecord.mock.invocationCallOrder[0]
    );
  });

  it("should handle failure in sending SQS message and call all rollback functions in correct order", async () => {
    mockSendSQSMessage.mockResolvedValue(
      Result.fail(new AcquireReleaseError(new Error("Failed to send message")))
    );

    const result = await processUserData(
      mockUserData,
      mockCreateUserRecord,
      mockCreateS3Bucket,
      mockUploadRecordToS3,
      mockSendSQSMessage,
      mockDeleteRecordFromS3,
      mockDeleteS3Bucket,
      mockDeleteUserRecord
    );

    expect(result.isFailure()).toBe(true);
    expect(result.error).toHaveProperty("_tag", "SQSUploadError");
    expect(result.error.rollbackFns).toHaveLength(3);

    // Call rollback and check if all functions were called in the correct order
    await result.error.rollback();
    expect(mockDeleteRecordFromS3).toHaveBeenCalledWith(
      mockBucketName,
      mockRecordId
    );
    expect(mockDeleteS3Bucket).toHaveBeenCalledWith(mockBucketName);
    expect(mockDeleteUserRecord).toHaveBeenCalledWith(mockUserId);

    // Check the order of calls
    expect(mockDeleteRecordFromS3.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteS3Bucket.mock.invocationCallOrder[0]
    );
    expect(mockDeleteS3Bucket.mock.invocationCallOrder[0]).toBeLessThan(
      mockDeleteUserRecord.mock.invocationCallOrder[0]
    );
  });
});
