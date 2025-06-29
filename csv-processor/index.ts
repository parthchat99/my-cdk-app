import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import * as crypto from 'crypto';
import csv from 'csv-parser';

const sqs = new SQSClient({});
const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient());

const queueUrl = process.env.SQS_QUEUE_URL!;
const plantsTable = process.env.PLANTS_TABLE!;
const vaccinesTable = process.env.VACCINES_TABLE!; // ✅ Added

console.log('✅ ECS container started, polling SQS...');

async function pollQueue() {
  while (true) {
    const response = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
      })
    );

    if (!response.Messages || response.Messages.length === 0) continue;

    for (const message of response.Messages) {
      if (!message.Body) continue;

      try {
        const body = JSON.parse(message.Body);
        const records = body.Records ?? [];

        for (const record of records) {
          const bucket = record.s3.bucket.name;
          const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
          console.log(`📁 Processing S3 file: ${bucket}/${key}`);

          const data = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
          const content = await streamToString(data.Body);
          const checksum = crypto.createHash('sha256').update(content).digest('hex');

          // 🔍 Determine table and key field from filename
          const isVaccine = key.toLowerCase().includes('vaccine');
          const tableName = isVaccine ? vaccinesTable : plantsTable;
          const keyField = isVaccine ? 'vaccineId' : 'plantId';

          const existing = await ddb.send(
            new GetCommand({
              TableName: tableName,
              Key: { [keyField]: `checksum_${key}` },
            })
          );

          if (existing.Item?.checksum === checksum) {
            console.log('⚠️ Already processed file, skipping.');
            continue;
          }

          const rows = await parseCsv(content);
          for (const row of rows) {
            if (!row[keyField]) {
              console.warn(`⚠️ Skipping row missing key ${keyField}:`, row);
              continue;
            }

            await ddb.send(new PutCommand({ TableName: tableName, Item: row }));
          }

          // 💾 Save checksum marker
          await ddb.send(
            new PutCommand({
              TableName: tableName,
              Item: { [keyField]: `checksum_${key}`, checksum },
            })
          );

          console.log('✅ Processing complete.');
        }

        // 🧹 Delete message after successful processing
        await sqs.send(
          new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle!,
          })
        );
      } catch (err) {
        console.error('❌ Processing error:', err);
      }
    }
  }
}

function streamToString(stream: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on('data', (chunk: any) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

function parseCsv(content: string): Promise<any[]> {
  const results: any[] = [];
  const stream = require('stream');
  const Readable = stream.Readable;
  const rs = new Readable();
  rs.push(content);
  rs.push(null);
  return new Promise((resolve, reject) => {
    rs.pipe(csv())
      .on('data', (data: any) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

pollQueue().catch(console.error);
