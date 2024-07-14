import { acquireRelease } from "./alt-acq";
import { ErrorType, Failure, Result } from "./alt-result";

export class RecordCreateError<E extends ErrorType> {
  readonly _tag = "RecordCreateError";
  readonly reason: Failure<E>;
  rollbackFns: Array<() => Promise<Result<unknown, E>>>;

  constructor(
    reason: Failure<E>,
    rollbackFns: Array<() => Promise<Result<unknown, E>>> = []
  ) {
    this.reason = reason;
    this.rollbackFns = rollbackFns;
  }

  rollback() {
    for (const rollbackFn of this.rollbackFns) {
      rollbackFn();
    }
  }
}

export class S3Error<E extends ErrorType> {
  readonly _tag = "S3Error";
  readonly reason: Failure<E>;
  rollbackFns: Array<() => Promise<Result<unknown, E>>>;

  constructor(
    reason: Failure<E>,
    rollbackFns: Array<() => Promise<Result<unknown, E>>> = []
  ) {
    this.reason = reason;
    this.rollbackFns = rollbackFns;
  }

  rollback() {
    for (const rollbackFn of this.rollbackFns) {
      rollbackFn();
    }
  }
}

export class SQSUploadError<E extends ErrorType> {
  readonly _tag = "SQSUploadError";
  readonly reason: Failure<E>;
  rollbackFns: Array<() => Promise<Result<unknown, E>>>;

  constructor(
    reason: Failure<E>,
    rollbackFns: Array<() => Promise<Result<unknown, E>>> = []
  ) {
    this.reason = reason;
    this.rollbackFns = rollbackFns;
  }

  rollback() {
    for (const rollbackFn of this.rollbackFns) {
      rollbackFn();
    }
  }
}

export async function processUserData(
  userData: {
    name: string;
    email: string;
  },
  createUserRecord: (userData: { name: string; email: string }) => Promise<
    Result<
      {
        name: string;
        email: string;
        userId: string;
      },
      ErrorType
    >
  >,
  createS3Bucket: (bucketName: string) => Promise<
    Result<
      {
        bucketName: string;
      },
      ErrorType
    >
  >,
  uploadRecordToS3: (
    bucketName: string,
    data: any
  ) => Promise<
    Result<
      {
        recordId: string;
      },
      ErrorType
    >
  >,
  sendSQSMessage: (message: any) => Promise<
    Result<
      {
        message: string;
      },
      ErrorType
    >
  >,
  deleteRecordFromS3: (
    bucketName: string,
    recordId: string
  ) => Promise<
    Result<
      {
        message: string;
      },
      ErrorType
    >
  >,
  deleteS3Bucket: (bucketName: string) => Promise<
    Result<
      {
        message: string;
      },
      ErrorType
    >
  >,
  deleteUserRecord: (userId: string) => Promise<
    Result<
      {
        message: string;
      },
      ErrorType
    >
  >
) {
  // Step 1: Create user record
  const recordCreateResult = await acquireRelease(
    () => createUserRecord(userData),
    async (user) => {
      console.log(`Releasing user record`);
      return await deleteUserRecord(user.userId);
    }
  );
  if (recordCreateResult.isFailure()) {
    return Result.fail(new RecordCreateError(recordCreateResult));
  }

  const { resource: user, release: releaseUser } = recordCreateResult.data;
  console.log("User record created:", user);

  // Step 2: Create S3 bucket
  const s3BucketCreateResult = await acquireRelease(
    () => createS3Bucket(`user-${user.userId}-bucket`),
    (bucket) => {
      console.log(`Releasing S3 bucket`);
      return deleteS3Bucket(bucket.bucketName);
    }
  );
  if (s3BucketCreateResult.isFailure()) {
    return Result.fail(new S3Error(s3BucketCreateResult, [releaseUser]));
  }

  const { resource: bucket, release: releaseBucket } =
    s3BucketCreateResult.data;
  console.log("S3 bucket created:", bucket);

  // Step 3: Upload record to S3
  const uploadToS3Result = await acquireRelease(
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
  if (uploadToS3Result.isFailure()) {
    return Result.fail(
      new S3Error(uploadToS3Result, [releaseBucket, releaseUser])
    );
  }

  const { resource: record, release: rollbackUpload } = uploadToS3Result.data;
  console.log("Record uploaded to S3:", record);

  // Step 4: Send SQS message
  const sendSQSMessageResult = await acquireRelease(
    () => sendSQSMessage({ userId: user.userId, recordId: record.recordId }),
    () => Promise.resolve(Result.succeed(undefined)) // No specific cleanup for SQS
  );
  if (sendSQSMessageResult.isFailure()) {
    return Result.fail(
      new SQSUploadError(sendSQSMessageResult, [
        rollbackUpload,
        releaseBucket,
        releaseUser,
      ])
    );
  }
  const sqsResult = sendSQSMessageResult.data;

  console.log("SQS message sent successfully:", sqsResult);

  console.log("Process completed successfully");
  return Result.succeed(undefined);
}
