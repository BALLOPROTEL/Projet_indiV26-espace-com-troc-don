import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

type StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

type ReadObjectResult = {
  body: Buffer;
  contentType: string;
  contentLength?: number;
};

@Injectable()
export class ObjectStorageService {
  private client?: S3Client;
  private storageConfig?: StorageConfig;

  constructor(private readonly configService: ConfigService) {}

  async assertReady(): Promise<void> {
    const { client, config } = this.getClient();

    try {
      await client.send(
        new HeadBucketCommand({
          Bucket: config.bucket,
        }),
      );
    } catch {
      throw new ServiceUnavailableException(
        'Object storage bucket is unavailable',
      );
    }
  }

  async putObject(
    objectKey: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    const { client, config } = this.getClient();

    try {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: objectKey,
          Body: body,
          ContentType: contentType,
          ContentLength: body.length,
          CacheControl: 'private, max-age=0, no-store',
        }),
      );
    } catch {
      throw new ServiceUnavailableException(
        'Unable to store image',
      );
    }
  }

  async readObject(objectKey: string): Promise<ReadObjectResult> {
    const { client, config } = this.getClient();

    try {
      const output = await client.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: objectKey,
        }),
      );

      if (!output.Body) {
        throw new Error('Missing object body');
      }

      const bytes = await output.Body.transformToByteArray();

      return {
        body: Buffer.from(bytes),
        contentType:
          output.ContentType ?? 'application/octet-stream',
        contentLength: output.ContentLength,
      };
    } catch {
      throw new ServiceUnavailableException(
        'Unable to read image',
      );
    }
  }

  async deleteObjects(objectKeys: string[]): Promise<void> {
    if (objectKeys.length === 0) {
      return;
    }

    const { client, config } = this.getClient();

    try {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: config.bucket,
          Delete: {
            Quiet: true,
            Objects: objectKeys.map((Key) => ({ Key })),
          },
        }),
      );
    } catch {
      throw new ServiceUnavailableException(
        'Unable to delete images',
      );
    }
  }

  getBucketName(): string {
    return this.getConfig().bucket;
  }

  private getClient(): {
    client: S3Client;
    config: StorageConfig;
  } {
    const config = this.getConfig();

    if (!this.client) {
      this.client = new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        forcePathStyle: config.forcePathStyle,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
    }

    return {
      client: this.client,
      config,
    };
  }

  private getConfig(): StorageConfig {
    if (this.storageConfig) {
      return this.storageConfig;
    }

    const endpoint =
      this.configService.get<string>('S3_ENDPOINT')?.trim();
    const bucket =
      this.configService.get<string>('S3_BUCKET')?.trim();
    const accessKeyId =
      this.configService.get<string>('S3_ACCESS_KEY')?.trim();
    const secretAccessKey =
      this.configService.get<string>('S3_SECRET_KEY')?.trim();

    if (
      !endpoint ||
      !bucket ||
      !accessKeyId ||
      !secretAccessKey
    ) {
      throw new ServiceUnavailableException(
        'Object storage is not configured',
      );
    }

    this.storageConfig = {
      endpoint,
      bucket,
      accessKeyId,
      secretAccessKey,
      region:
        this.configService.get<string>('S3_REGION')?.trim() ||
        'us-east-1',
      forcePathStyle:
        this.configService.get<string>('S3_FORCE_PATH_STYLE') !==
        'false',
    };

    return this.storageConfig;
  }
}
