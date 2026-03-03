import uuid
import boto3
from app.core.config import settings

def s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name="us-east-1",
    )

def make_storage_key(car_id: int, filename: str) -> str:
    ext = filename.split(".")[-1].lower()
    return f"cars/{car_id}/{uuid.uuid4().hex}.{ext}"

def presign_put(storage_key: str, content_type: str) -> str:
    c = s3_client()
    return c.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": settings.S3_BUCKET,
            "Key": storage_key,
            "ContentType": content_type,
        },
        ExpiresIn=60 * 10,
    )