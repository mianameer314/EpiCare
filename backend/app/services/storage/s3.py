"""S3-compatible object storage provider for Railway and production deployments."""
from __future__ import annotations

import logging

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings
from app.services.storage.base import StorageProvider

logger = logging.getLogger(__name__)


class S3StorageProvider(StorageProvider):
    """Store application files in an AWS S3-compatible bucket."""

    def __init__(self) -> None:
        if not settings.AWS_BUCKET_NAME:
            raise RuntimeError("AWS_BUCKET_NAME must be configured when STORAGE_PROVIDER=s3")
        if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
            raise RuntimeError("AWS credentials must be configured when STORAGE_PROVIDER=s3")

        client_kwargs: dict[str, str] = {
            "service_name": "s3",
            "region_name": settings.AWS_REGION,
            "aws_access_key_id": settings.AWS_ACCESS_KEY_ID,
            "aws_secret_access_key": settings.AWS_SECRET_ACCESS_KEY,
        }
        if settings.AWS_ENDPOINT_URL:
            client_kwargs["endpoint_url"] = settings.AWS_ENDPOINT_URL

        self.bucket = settings.AWS_BUCKET_NAME
        self.client = boto3.client(**client_kwargs)

    def save(self, file_bytes: bytes, key: str) -> str:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=file_bytes)
        logger.info("stored_s3_file", extra={"bucket": self.bucket, "key": key, "bytes": len(file_bytes)})
        return key

    def delete(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            error_code = str(exc.response.get("Error", {}).get("Code", ""))
            if error_code in {"404", "NoSuchKey", "NotFound"}:
                return False
            raise

        self.client.delete_object(Bucket=self.bucket, Key=key)
        logger.info("deleted_s3_file", extra={"bucket": self.bucket, "key": key})
        return True

    def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError as exc:
            error_code = str(exc.response.get("Error", {}).get("Code", ""))
            if error_code in {"403", "404", "NoSuchKey", "NotFound"}:
                return False
            raise

    def read(self, key: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        body = response["Body"]
        try:
            return body.read()
        finally:
            body.close()
