import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as path from 'path';
import * as logs from 'aws-cdk-lib/aws-logs';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Platform } from 'aws-cdk-lib/aws-ecr-assets';

interface IngestionStackProps extends cdk.StackProps {
  vaccinesTable: dynamodb.Table;
  plantsTable: dynamodb.Table;
}

export class IngestionStack extends cdk.Stack {
  public readonly uploadBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: IngestionStackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'CsvUploadBucket');
    this.uploadBucket = bucket; // Make bucket accessible to other stacks
    
    const deadLetterQueue = new sqs.Queue(this, 'CsvDLQ');
    const queue = new sqs.Queue(this, 'CsvProcessingQueue', {
      deadLetterQueue: {
        maxReceiveCount: 1, // ⛔ Retry only once (or 0 if you want no retry)
        queue: deadLetterQueue,
      },
    });
    bucket.addEventNotification(s3.EventType.OBJECT_CREATED_PUT, new s3n.SqsDestination(queue));

    const vpc = new ec2.Vpc(this, 'FargateVpc', {
      maxAzs: 2,
      natGateways: 1, // Ensure internet access for ECS tasks
    });
    const cluster = new ecs.Cluster(this, 'CsvProcessorCluster', { vpc });

    const taskRole = new iam.Role(this, 'CsvProcessorTaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });
    props.plantsTable.grantReadWriteData(taskRole);
    props.vaccinesTable.grantReadWriteData(taskRole);
    bucket.grantRead(taskRole);
    queue.grantConsumeMessages(taskRole);

    const executionRole = new iam.Role(this, 'CsvProcessorExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'CsvProcessorTaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512,
      taskRole,
      executionRole
    });

    taskDefinition.addContainer('CsvProcessorContainer', {
      image: ecs.ContainerImage.fromAsset(path.join(__dirname, '../csv-processor'), {
        platform: Platform.LINUX_AMD64,
      }),
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'CsvProcessor',
        logGroup: new logs.LogGroup(this, 'CsvProcessorLogsParth', {
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      }),
      environment: {
        BUCKET_NAME: bucket.bucketName,
        PLANTS_TABLE: props.plantsTable.tableName,
        VACCINES_TABLE: props.vaccinesTable.tableName,
        SQS_QUEUE_URL: queue.queueUrl,
      },
      essential: true,
    });

    new ecs_patterns.QueueProcessingFargateService(this, 'CsvFargateService', {
      cluster,
      queue,
      taskDefinition,
      maxScalingCapacity: 2, // 🔥 Force at least one task to always run
      minScalingCapacity: 1, // 🔥 Prevent scale-down to zero
    });

    new logs.LogGroup(this, 'DLQLogGroup', {
      logGroupName: '/aws/ecs/CsvDLQ',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }
}