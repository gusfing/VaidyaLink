#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VaidyaLinkStack } from '../lib/vaidyalink-stack';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = new cdk.App();

// Get environment from context
const env = app.node.tryGetContext('env') || 'dev';

// Load environment-specific configuration
const config = require(`../config/${env}.json`);

// Create the main stack
new VaidyaLinkStack(app, `VaidyaLink-${env}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || config.region,
  },
  stackName: `vaidyalink-${env}`,
  description: `VaidyaLink Infrastructure Stack - ${env} environment`,
  tags: {
    Environment: env,
    Project: 'VaidyaLink',
    ManagedBy: 'CDK',
  },
  config,
});

app.synth();
