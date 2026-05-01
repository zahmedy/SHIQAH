import uuid
import boto3
from botocore.config import Config

from app.core.config import settings

S3_CLIENT_CONFIG = Config(
    signature_version="s3",
    s3={"addressing_style": "path"},
)


def _blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def s3_client(endpoint_url: str | None = None):
    return boto3.client(
        "s3",
        endpoint_url=_blank_to_none(endpoint_url) or settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name="us-east-1",
        config=S3_CLIENT_CONFIG,
    )

def make_storage_key(car_id: int, filename: str) -> str:
    ext = filename.split(".")[-1].lower()
    return f"cars/{car_id}/{uuid.uuid4().hex}.{ext}"

def presign_put(storage_key: str, content_type: str, endpoint_url: str | None = None) -> str:
    c = s3_client(endpoint_url or settings.S3_PRESIGN_BASE_URL)
    return c.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": settings.S3_BUCKET,
            "Key": storage_key,
            "ContentType": content_type,
        },
        ExpiresIn=60 * 10,
    )


def delete_object(storage_key: str) -> None:
    c = s3_client()
    c.delete_object(Bucket=settings.S3_BUCKET, Key=storage_key)
