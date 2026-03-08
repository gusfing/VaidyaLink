"""
AWS Secrets Manager utility for Python Lambda functions
Provides caching and easy access to secrets stored in AWS Secrets Manager
"""

import json
import os
import time
from typing import Any, Dict, List, Optional, Union

import boto3
from botocore.exceptions import ClientError


class SecretsManager:
    """
    Secrets Manager client with caching support
    """

    def __init__(self, region: Optional[str] = None, cache_ttl: int = 300):
        """
        Initialize Secrets Manager client

        Args:
            region: AWS region (defaults to AWS_REGION env var or ap-south-1)
            cache_ttl: Cache time-to-live in seconds (default: 300)
        """
        self.region = region or os.environ.get("AWS_REGION", "ap-south-1")
        self.client = boto3.client("secretsmanager", region_name=self.region)
        self.cache: Dict[str, Any] = {}
        self.cache_ttl = cache_ttl
        self.cache_timestamps: Dict[str, float] = {}

    def get_secret(
        self, secret_name: str, force_refresh: bool = False
    ) -> Union[Dict, str]:
        """
        Get a secret value from AWS Secrets Manager

        Args:
            secret_name: The name or ARN of the secret
            force_refresh: Force refresh from AWS (bypass cache)

        Returns:
            The secret value (parsed JSON dict or string)

        Raises:
            Exception: If secret retrieval fails
        """
        # Check cache first
        if not force_refresh and self._is_cache_valid(secret_name):
            return self.cache[secret_name]

        try:
            response = self.client.get_secret_value(SecretId=secret_name)

            # Parse secret value
            if "SecretString" in response:
                secret_value = response["SecretString"]
                try:
                    secret_value = json.loads(secret_value)
                except json.JSONDecodeError:
                    pass  # Keep as string if not JSON
            else:
                # Binary secret
                secret_value = response["SecretBinary"].decode("utf-8")

            # Cache the secret
            self.cache[secret_name] = secret_value
            self.cache_timestamps[secret_name] = time.time()

            return secret_value

        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            print(f"Error retrieving secret {secret_name}: {error_code}")
            raise Exception(f"Failed to retrieve secret: {e}")

    def get_abdm_credentials(self) -> Dict[str, str]:
        """
        Get ABDM API credentials

        Returns:
            Dict containing ABDM credentials
        """
        environment = os.environ.get("ENVIRONMENT", "dev")
        return self.get_secret(f"vaidyalink/{environment}/abdm/api-credentials")

    def get_bhashini_credentials(self) -> Dict[str, str]:
        """
        Get Bhashini API credentials

        Returns:
            Dict containing Bhashini credentials
        """
        environment = os.environ.get("ENVIRONMENT", "dev")
        return self.get_secret(f"vaidyalink/{environment}/bhashini/api-credentials")

    def get_bedrock_config(self) -> Dict[str, str]:
        """
        Get Bedrock configuration

        Returns:
            Dict containing Bedrock config
        """
        environment = os.environ.get("ENVIRONMENT", "dev")
        return self.get_secret(f"vaidyalink/{environment}/bedrock/config")

    def get_database_credentials(self) -> Dict[str, str]:
        """
        Get database credentials

        Returns:
            Dict containing database credentials
        """
        environment = os.environ.get("ENVIRONMENT", "dev")
        return self.get_secret(f"vaidyalink/{environment}/database/credentials")

    def get_jwt_signing_secret(self) -> str:
        """
        Get JWT signing secret

        Returns:
            JWT signing secret string
        """
        environment = os.environ.get("ENVIRONMENT", "dev")
        return self.get_secret(f"vaidyalink/{environment}/jwt/signing-key")

    def _is_cache_valid(self, secret_name: str) -> bool:
        """
        Check if cached secret is still valid

        Args:
            secret_name: The name of the secret

        Returns:
            True if cache is valid
        """
        if secret_name not in self.cache:
            return False

        timestamp = self.cache_timestamps.get(secret_name, 0)
        return time.time() - timestamp < self.cache_ttl

    def clear_cache(self, secret_name: Optional[str] = None) -> None:
        """
        Clear the cache for a specific secret or all secrets

        Args:
            secret_name: Optional secret name to clear
        """
        if secret_name:
            self.cache.pop(secret_name, None)
            self.cache_timestamps.pop(secret_name, None)
        else:
            self.cache.clear()
            self.cache_timestamps.clear()

    def get_secrets(self, secret_names: List[str]) -> Dict[str, Any]:
        """
        Batch get multiple secrets

        Args:
            secret_names: List of secret names

        Returns:
            Dict with secret names as keys and values
        """
        results = {}
        for name in secret_names:
            try:
                results[name] = self.get_secret(name)
            except Exception as e:
                print(f"Failed to retrieve secret {name}: {e}")
                results[name] = None

        return results


# Singleton instance for Lambda container reuse
_instance: Optional[SecretsManager] = None


def get_instance(region: Optional[str] = None, cache_ttl: int = 300) -> SecretsManager:
    """
    Get singleton instance of SecretsManager

    Args:
        region: AWS region
        cache_ttl: Cache time-to-live in seconds

    Returns:
        SecretsManager instance
    """
    global _instance
    if _instance is None:
        _instance = SecretsManager(region=region, cache_ttl=cache_ttl)
    return _instance
