import { succeed } from "./result";

export const unexpectedFailure = () => {
  throw new Error("Unexpected error");
};

// Mock functions (replace these with your actual implementations)
export const createUserRecord = (userData: { name: string; email: string }) =>
  Promise.resolve(succeed({ userId: "user123", ...userData }));

export const createS3Bucket = (bucketName: string) =>
  Promise.resolve(succeed({ bucketName }));

export const uploadRecordToS3 = (bucketName: string, data: any) =>
  unexpectedFailure();
Promise.resolve(succeed({ recordId: "record123" }));

export const sendSQSMessage = (message: any) =>
  Promise.resolve(succeed({ message: "SQS message sent" }));

export const deleteUserRecord = (userId: string) =>
  Promise.resolve(
    succeed({
      message: "User record deleted",
    })
  );

export const deleteS3Bucket = (bucketName: string) =>
  Promise.resolve(
    succeed({
      message: "S3 bucket deleted",
    })
  );

export const deleteRecordFromS3 = (bucketName: string, recordId: string) =>
  Promise.resolve(
    succeed({
      message: "S3 record deleted",
    })
  );
