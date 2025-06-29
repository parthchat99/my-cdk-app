// csvUploadHandler.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { APIGatewayProxyHandler } from 'aws-lambda';
// @ts-ignore: No type declaration available
import * as multipart from 'aws-lambda-multipart-parser';

const s3 = new S3Client({});
const BUCKET_NAME = process.env.UPLOAD_BUCKET!;

export const handler: APIGatewayProxyHandler = async (event: any) => {
  try {
    const parsed: any = multipart.parse(event, true); // parse base64 body
    const file = parsed.file;

    if (!(file?.content && file?.filename)) {
      return { statusCode: 400, body: 'CSV file is required' };
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `uploads/${Date.now()}-${file.filename}`,
        Body: file.content,
        ContentType: file.contentType,
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'File uploaded to S3 successfully' }),
    };
  } catch (err) {
    console.error('Upload error:', err);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
