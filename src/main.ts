import { acquireRelease } from "./acquireRelease";
import { Result, Success, fail, succeed } from "./result";
import {
  createUserRecord as createUserRecordMock,
  createS3Bucket as createS3BucketMock,
  uploadRecordToS3 as uploadRecordToS3Mock,
  sendSQSMessage as sendSQSMessageMock,
  deleteRecordFromS3 as deleteRecordFromS3Mock,
  deleteS3Bucket as deleteS3BucketMock,
  deleteUserRecord as deleteUserRecordMock,
} from "./mockFunctions";

export async function processUserData(
  userData: {
    name: string;
    email: string;
  },
  createUserRecord: (userData: { name: string; email: string }) => Promise<
    Success<{
      name: string;
      email: string;
      userId: string;
    }>
  >,
  createS3Bucket: (bucketName: string) => Promise<
    Success<{
      bucketName: string;
    }>
  >,
  uploadRecordToS3: (
    bucketName: string,
    data: any
  ) => Promise<
    Success<{
      recordId: string;
    }>
  >,
  sendSQSMessage: (message: any) => Promise<
    Success<{
      message: string;
    }>
  >,
  deleteRecordFromS3: (
    bucketName: string,
    recordId: string
  ) => Promise<
    Success<{
      message: string;
    }>
  >,
  deleteS3Bucket: (bucketName: string) => Promise<
    Success<{
      message: string;
    }>
  >,
  deleteUserRecord: (userId: string) => Promise<
    Success<{
      message: string;
    }>
  >
): Promise<Result<void, Error>> {
  const releaseFunctions: Array<() => Promise<Result<unknown, Error>>> = [];

  try {
    // Step 1: Create user record
    const { resource: user, release: releaseUser } = await acquireRelease(
      () => createUserRecord(userData),
      async (user) => {
        console.log(`Releasing user record`);
        return await deleteUserRecord(user.userId);
      }
    );
    releaseFunctions.push(releaseUser);
    console.log("User record created:", user);

    // Step 2: Create S3 bucket
    const { resource: bucket, release: releaseBucket } = await acquireRelease(
      () => createS3Bucket(`user-${user.userId}-bucket`),
      (bucket) => {
        console.log(`Releasing S3 bucket`);
        return deleteS3Bucket(bucket.bucketName);
      }
    );
    releaseFunctions.push(releaseBucket);
    console.log("S3 bucket created:", bucket);

    // Step 3: Upload record to S3
    const { resource: record, release: releaseRecord } = await acquireRelease(
      () =>
        uploadRecordToS3(bucket.bucketName, {
          userId: user.userId,
          data: userData,
        }),
      (record) => {
        console.log(`Releasing S3 record due`);
        return deleteRecordFromS3(bucket.bucketName, record.recordId);
      }
    );
    releaseFunctions.push(releaseRecord);
    console.log("Record uploaded to S3:", record);

    // Step 4: Send SQS message
    const { resource: sqsResult } = await acquireRelease(
      () => sendSQSMessage({ userId: user.userId, recordId: record.recordId }),
      () => Promise.resolve(succeed(undefined)) // No specific cleanup for SQS
    );
    console.log("SQS message sent successfully:", sqsResult);

    console.log("Process completed successfully");
    return succeed(undefined);
  } catch (error) {
    console.error("Error occurred:", (error as Error).message);
    console.log("Starting rollback...");

    for (const releaseFunc of releaseFunctions.reverse()) {
      await releaseFunc();
    }

    // Normally we would rethrow the error for handling higher given it's unexpected
    // throw error;

    return fail(error as Error);
  }
}
// Run the process
processUserData(
  { name: "John Doe", email: "john@example.com" },
  createUserRecordMock,
  createS3BucketMock,
  uploadRecordToS3Mock,
  sendSQSMessageMock,
  deleteRecordFromS3Mock,
  deleteS3BucketMock,
  deleteUserRecordMock
);
