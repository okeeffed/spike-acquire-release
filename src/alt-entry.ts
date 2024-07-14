import { S3Error, SQSUploadError, processUserData } from "./alt-main";
import { ErrorType, Result } from "./alt-result";

const unexpectedFailure = () => {
  throw new Error("Unexpected error");
};

// Mock functions (replace these with your actual implementations)
const createUserRecord = (userData: { name: string; email: string }) =>
  Promise.resolve(Result.succeed({ userId: "user123", ...userData }));

const createS3Bucket = (bucketName: string) =>
  Promise.resolve(Result.succeed({ bucketName }));

const uploadRecordToS3 = (bucketName: string, data: any) =>
  Promise.resolve(Result.succeed({ recordId: "record123" }));

const sendSQSMessage = (message: any) => unexpectedFailure();
// Promise.resolve(Result.succeed({ message: "SQS message sent" }));

const deleteUserRecord = (
  userId: string
): Promise<Result<{ message: string }, never>> =>
  new Promise((resolve) => {
    setTimeout(() => {
      console.log("Deleted user record");
      resolve(
        Result.succeed({
          message: "User record deleted",
        })
      );
    }, 1000);
  });

const deleteS3Bucket = (
  bucketName: string
): Promise<Result<{ message: string }, never>> =>
  new Promise((resolve) => {
    setTimeout(() => {
      console.log("Deleted S3 bucket");
      resolve(
        Result.succeed({
          message: "S3 bucket deleted",
        })
      );
    }, 1000);
  });

const deleteRecordFromS3 = (
  bucketName: string,
  recordId: string
): Promise<Result<{ message: string }, never>> =>
  new Promise((resolve) => {
    setTimeout(() => {
      console.log("Deleted S3 record");
      resolve(
        Result.succeed({
          message: "S3 record deleted",
        })
      );
    }, 1000);
  });

async function main() {
  // Run the process
  const result = await processUserData(
    { name: "John Doe", email: "john@example.com" },
    createUserRecord,
    createS3Bucket,
    uploadRecordToS3,
    sendSQSMessage,
    deleteRecordFromS3,
    deleteS3Bucket,
    deleteUserRecord
  );

  await Result.matchTag(result, {
    Success: () => console.log("Success"),
    S3Error: (error: S3Error<ErrorType>) => console.error("S3Error", error),
    SQSUploadError: async (error: SQSUploadError<ErrorType>) => {
      console.error("SQSUploadError", error);

      await error.rollback();
    },
  });
}

main();
