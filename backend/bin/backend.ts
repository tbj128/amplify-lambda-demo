#!/usr/bin/env node
import { App } from '@aws-cdk/core';
import { EdMonitorAppBackendStack } from '../lib/backend-stack';

const app = new App();
new EdMonitorAppBackendStack(app, 'EdMonitorAppBackendStack');
