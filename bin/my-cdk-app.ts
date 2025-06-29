#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BaseStack } from '../lib/base-stack';
import { ApiStack } from '../lib/api-stack';
import { IngestionStack } from '../lib/ingestion-stack';

const app = new cdk.App();

app.node.setContext('aws:cdk:enable-path-metadata', true);
app.node.setContext('aws:cdk:enable-stack-trace', true);

const baseStack = new BaseStack(app, 'BaseStack');

const ingestionStack = new IngestionStack(app, 'IngestionStack', {
  vaccinesTable: baseStack.vaccinesTable,
  plantsTable: baseStack.plantsTable,
});

new ApiStack(app, 'ApiStack', {
  vaccinesTable: baseStack.vaccinesTable,
  plantsTable: baseStack.plantsTable,
  uploadBucket: ingestionStack.uploadBucket,
});

