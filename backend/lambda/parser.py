"""
Converts an NumPy waveform file into a string for the website to render
"""
import io
import json
import boto3
import sys
import os
import numpy as np

def lambda_handler(event, context):
    bucket_name = os.environ['bucket']
    name = event["queryStringParameters"]["name"]
    print(f"Starting parser with bucket={bucket_name} and name={name}")

    obj = boto3.resource("s3").Object(bucket_name, name)
    with io.BytesIO(obj.get()["Body"].read()) as f:
        f.seek(0)  # rewind the file
        arr = np.load(f).tolist()

    response = {
        "statusCode": 200,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": True
        },
        "body": json.dumps(arr)
    }
    return response
