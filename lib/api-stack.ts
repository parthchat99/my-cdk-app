import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

interface ApiStackProps extends cdk.StackProps {
  vaccinesTable: dynamodb.Table;
  plantsTable: dynamodb.Table;
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const handler = new NodejsFunction(this, 'LambdaHandler', {
      entry: path.join(__dirname, '../lambda/handler.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      environment: {
        VACCINES_TABLE: props.vaccinesTable.tableName,
        PLANTS_TABLE: props.plantsTable.tableName,
      },
    })

    props.vaccinesTable.grantReadData(handler);
    props.plantsTable.grantReadData(handler);

    new apigateway.LambdaRestApi(this, 'APIGateway', {
      handler: handler,
    });
  }
}
