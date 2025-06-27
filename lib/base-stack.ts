import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class BaseStack extends cdk.Stack {
  public readonly vaccinesTable: dynamodb.Table;
  public readonly plantsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.vaccinesTable = new dynamodb.Table(this, 'VaccinesTable', {
      partitionKey: { name: 'vaccineId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.plantsTable = new dynamodb.Table(this, 'PlantsTable', {
      partitionKey: { name: 'plantId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}
