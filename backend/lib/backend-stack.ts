import apigateway = require('@aws-cdk/aws-apigateway');
import lambda = require('@aws-cdk/aws-lambda');
import ec2 = require('@aws-cdk/aws-ec2');
import { RetentionDays } from '@aws-cdk/aws-logs';
import cdk = require('@aws-cdk/core');
import { Bucket, BucketEncryption, HttpMethods } from '@aws-cdk/aws-s3';
import { Role, ServicePrincipal, PolicyDocument, PolicyStatement, Effect } from '@aws-cdk/aws-iam';

import iam = require('@aws-cdk/aws-iam');
import cr = require('@aws-cdk/custom-resources');
import path = require('path');
import { DockerImageCode, DockerImageFunction } from '@aws-cdk/aws-lambda';


export class EdMonitorAppBackendStack extends cdk.Stack {
    constructor(app: cdk.App, id: string) {
        super(app, id, {
            env: {
                region: 'us-west-2'
            },
        });

        // Create public upload bucket
        //
        const uploadedFilesBucket = new Bucket(this, 'EdMonitorUploadBucket', {
            bucketName: `ed-monitor-uploads-${this.account}`,
            encryption: BucketEncryption.S3_MANAGED,
            publicReadAccess: false,
        });
        uploadedFilesBucket.addCorsRule({
            allowedHeaders: ['*'],
            allowedMethods: [HttpMethods.GET, HttpMethods.HEAD, HttpMethods.PUT, HttpMethods.POST, HttpMethods.DELETE],
            allowedOrigins: ['*'],
            exposedHeaders: ['ETag'],
        });

        // VPC definition.
        const ecgVpc = new ec2.Vpc(this, 'EdMonitorVPC');

        const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'EdMonitorEFSMLLambdaSG', {
            vpc: ecgVpc,
            securityGroupName: "EdMonitorEFSMLLambdaSG",
        });

        // Lambda function to execute inference.
        //
        const lambdaRole = new Role(this, 'EdMonitorLambdaRole', {
            roleName: 'EdMonitorLambdaRole',
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            inlinePolicies: {
                additional: new PolicyDocument({
                    statements: [
                        new PolicyStatement({
                            effect: Effect.ALLOW,
                            actions: [
                                // IAM
                                'ec2:CreateNetworkInterface',
                                'ec2:Describe*',
                                'ec2:DeleteNetworkInterface',
                                // IAM
                                'iam:GetRole',
                                'iam:PassRole',
                                // Lambda
                                'lambda:InvokeFunction',
                                // S3
                                's3:GetObject',
                                's3:PutObject',
                                's3:ListBucket',
                                'kms:Decrypt',
                                'kms:Encrypt',
                                'kms:GenerateDataKey',
                                // STS
                                'sts:AssumeRole',
                                // CloudWatch
                                'cloudwatch:*',
                                'logs:*'
                            ],
                            resources: ['*']
                        })
                    ]
                }),
            },
        });

        const presignerFunction = new lambda.Function(this, 'EdMonitorPresigner', {
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: 'presigner.lambda_handler',
            code: lambda.Code.fromAsset(path.join(__dirname, "../lambda")),
            vpc: ecgVpc,
            vpcSubnets: ecgVpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE }),
            securityGroup: lambdaSecurityGroup,
            timeout: cdk.Duration.minutes(1),
            memorySize: 256,
            reservedConcurrentExecutions: 10,
            role: lambdaRole,
            environment: {
                "bucket": uploadedFilesBucket.bucketName,
            }
        });

        const parserFunction = new DockerImageFunction(this, 'EdMonitorParser', {
            code: DockerImageCode.fromImageAsset(path.join(__dirname, "..")),
            functionName: `QueryFunction`,
            memorySize: 512,
            role: lambdaRole,
            timeout: cdk.Duration.seconds(120),
            logRetention: RetentionDays.THREE_MONTHS,
            vpc: ecgVpc,
            vpcSubnets: ecgVpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE }),
            securityGroup: lambdaSecurityGroup,
            environment: {
                "bucket": uploadedFilesBucket.bucketName,
            }
        });


        // API Gateway
        //
        const api = new apigateway.RestApi(this, 'EdMonitorApiGateway', {
            restApiName: 'EdMonitor Service'
        });

        const presignerApi = api.root.addResource('presigner');
        const presignerIntegration = new apigateway.LambdaIntegration(presignerFunction);
        presignerApi.addMethod('GET', presignerIntegration);
        addCorsOptions(presignerApi);

        const parserApi = api.root.addResource('parser');
        const parserIntegration = new apigateway.LambdaIntegration(parserFunction);
        parserApi.addMethod('GET', parserIntegration);
        addCorsOptions(parserApi);
    }
}

export function addCorsOptions(apiResource: apigateway.IResource) {
    apiResource.addMethod('OPTIONS', new apigateway.MockIntegration({
        integrationResponses: [{
            statusCode: '200',
            responseParameters: {
                'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
                'method.response.header.Access-Control-Allow-Origin': "'*'",
                'method.response.header.Access-Control-Allow-Credentials': "'false'",
                'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
            },
        }],
        passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
        requestTemplates: {
            "application/json": "{\"statusCode\": 200}"
        },
    }), {
        methodResponses: [{
            statusCode: '200',
            responseParameters: {
                'method.response.header.Access-Control-Allow-Headers': true,
                'method.response.header.Access-Control-Allow-Methods': true,
                'method.response.header.Access-Control-Allow-Credentials': true,
                'method.response.header.Access-Control-Allow-Origin': true,
            },
        }]
    })
}
