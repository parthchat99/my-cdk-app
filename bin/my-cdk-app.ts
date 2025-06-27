#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BaseStack } from '../lib/base-stack';
import { ApiStack } from '../lib/api-stack';

const app = new cdk.App();

const baseStack = new BaseStack(app, 'BaseStack');

new ApiStack(app, 'ApiStack', {
  vaccinesTable: baseStack.vaccinesTable,
  plantsTable: baseStack.plantsTable,
});
