# Backend

The `backend` folder contains AWS CDK stacks and AWS Lambda function code that will help the website.

## Deployment

### Install
Install the core dependencies:
```
npm install
```

### CDK Deployment
Initialize the CDK stacks (required only if you have not deployed this stack before). Note that by default, all stacks are created in `us-east-1`:
```
cdk synth --profile stanfordmal
cdk bootstrap aws://YOUR_AWS_ACCOUNT_ID/us-east-1 --profile stanfordmal
```

Deploy the CDK stacks (~8 min first time):
```
cdk deploy --all --profile stanfordmal
```
