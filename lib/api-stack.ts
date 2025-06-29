import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

interface ApiStackProps extends cdk.StackProps {
  vaccinesTable: dynamodb.Table;
  plantsTable: dynamodb.Table;
  uploadBucket: s3.Bucket;
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // Lambda: GET data from DynamoDB
    const handler = new NodejsFunction(this, 'LambdaHandler', {
      entry: path.join(__dirname, '../lambda/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        VACCINES_TABLE: props.vaccinesTable.tableName,
        PLANTS_TABLE: props.plantsTable.tableName,
      },
    });

    props.vaccinesTable.grantReadData(handler);
    props.plantsTable.grantReadData(handler);

    // Lambda: POST /upload to store CSV in S3
    const csvUploadHandler = new NodejsFunction(this, 'CsvUploadHandler', {
      entry: path.join(__dirname, '../lambda/csvUploadHandler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        UPLOAD_BUCKET: props.uploadBucket.bucketName,
      },
    });

    props.uploadBucket.grantPut(csvUploadHandler);

    // REST API
    const api = new apigateway.RestApi(this, 'APIGateway');

    // GET /data endpoint
    const getResource = api.root.addResource('data');
    getResource.addMethod('GET', new apigateway.LambdaIntegration(handler));

    // POST /upload endpoint
    const uploadResource = api.root.addResource('upload');
    uploadResource.addMethod('POST', new apigateway.LambdaIntegration(csvUploadHandler));
  }
}