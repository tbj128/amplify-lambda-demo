"""
Generates a pre-signed URL that will allow users to upload their file to S3
"""

import json
import boto3
import os
from botocore.client import Config

def lambda_handler(event, context):
    bucket_name = os.environ['bucket']
    name = event["queryStringParameters"]["name"]
    print(f"Starting parser with bucket={bucket_name} and name={name}")
    presigned_obj = boto3.client('s3', endpoint_url=f'https://s3.us-west-2.amazonaws.com', config=Config(s3={'addressing_style': 'virtual'})).generate_presigned_post(bucket_name, name)

    response = {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": True
        },
        "body": json.dumps(presigned_obj)
    }
    return response
