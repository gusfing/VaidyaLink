#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MinimalDocumentScanStack } from '../lib/minimal-document-scan-stack';

const app = new cdk.App();

// Get environment from context
const env = app.node.tryGetContext('env') || 'dev';

// Minimal configuration
const config = {
  environment: env,
  region: 'ap-south-1',
  account: '038208944386',
};

new MinimalDocumentScanStack(app, `DocumentScan-${env}`, {
  env: {
    account: config.account,
    region: config.region,
  },
  stackName: `document-scan-${env}`,
  description: `Minimal Document Scan Stack for ${env} environment`,
  config,
});

app.synth();
