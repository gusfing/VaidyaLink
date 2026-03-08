"""
Tests for Secrets Manager utility
"""

import json
import time
import pytest
from unittest.mock import Mock, patch, MagicMock
from botocore.exceptions import ClientError

from secrets_manager import SecretsManager, get_instance


@pytest.fixture
def secrets_manager():
    """Create a SecretsManager instance for testing"""
    return SecretsManager(region="ap-south-1", cache_ttl=300)


@pytest.fixture
def mock_client():
    """Create a mock boto3 client"""
    with patch("secrets_manager.boto3.client") as mock:
        yield mock.return_value


class TestSecretsManager:
    def test_get_secret_json(self, secrets_manager, mock_client):
        """Test retrieving and parsing JSON secret"""
        mock_secret = {"clientId": "test-id", "clientSecret": "test-secret"}
        mock_client.get_secret_value.return_value = {
            "SecretString": json.dumps(mock_secret)
        }

        result = secrets_manager.get_secret("test-secret")

        assert result == mock_secret
        mock_client.get_secret_value.assert_called_once_with(SecretId="test-secret")

    def test_get_secret_plain_text(self, secrets_manager, mock_client):
        """Test retrieving plain text secret"""
        mock_client.get_secret_value.return_value = {
            "SecretString": "plain-text-secret"
        }

        result = secrets_manager.get_secret("test-secret")

        assert result == "plain-text-secret"

    def test_get_secret_binary(self, secrets_manager, mock_client):
        """Test retrieving binary secret"""
        mock_client.get_secret_value.return_value = {
            "SecretBinary": b"binary-secret"
        }

        result = secrets_manager.get_secret("test-secret")

        assert result == "binary-secret"

    def test_secret_caching(self, secrets_manager, mock_client):
        """Test that secrets are cached"""
        mock_secret = {"key": "value"}
        mock_client.get_secret_value.return_value = {
            "SecretString": json.dumps(mock_secret)
        }

        # First call
        secrets_manager.get_secret("test-secret")

        # Second call should use cache
        result = secrets_manager.get_secret("test-secret")

        assert result == mock_secret
        assert mock_client.get_secret_value.call_count == 1  # Only called once

    def test_force_refresh(self, secrets_manager, mock_client):
        """Test force refresh bypasses cache"""
        mock_secret = {"key": "value"}
        mock_client.get_secret_value.return_value = {
            "SecretString": json.dumps(mock_secret)
        }

        # First call
        secrets_manager.get_secret("test-secret")

        # Force refresh
        secrets_manager.get_secret("test-secret", force_refresh=True)

        assert mock_client.get_secret_value.call_count == 2

    def test_get_secret_error(self, secrets_manager, mock_client):
        """Test error handling"""
        mock_client.get_secret_value.side_effect = ClientError(
            {"Error": {"Code": "ResourceNotFoundException"}}, "GetSecretValue"
        )

        with pytest.raises(Exception, match="Failed to retrieve secret"):
            secrets_manager.get_secret("test-secret")

    def test_get_abdm_credentials(self, secrets_manager, mock_client, monkeypatch):
        """Test retrieving ABDM credentials"""
        monkeypatch.setenv("ENVIRONMENT", "dev")
        mock_creds = {
            "clientId": "abdm-id",
            "clientSecret": "abdm-secret",
            "apiBaseUrl": "https://dev.abdm.gov.in",
        }
        mock_client.get_secret_value.return_value = {
            "SecretString": json.dumps(mock_creds)
        }

        result = secrets_manager.get_abdm_credentials()

        assert result == mock_creds
        mock_client.get_secret_value.assert_called_once_with(
            SecretId="vaidyalink/dev/abdm/api-credentials"
        )

    def test_get_bhashini_credentials(self, secrets_manager, mock_client, monkeypatch):
        """Test retrieving Bhashini credentials"""
        monkeypatch.setenv("ENVIRONMENT", "dev")
        mock_creds = {
            "apiKey": "bhashini-key",
            "apiBaseUrl": "https://api.bhashini.gov.in",
        }
        mock_client.get_secret_value.return_value = {
            "SecretString": json.dumps(mock_creds)
        }

        result = secrets_manager.get_bhashini_credentials()

        assert result == mock_creds
        mock_client.get_secret_value.assert_called_once_with(
            SecretId="vaidyalink/dev/bhashini/api-credentials"
        )

    def test_get_bedrock_config(self, secrets_manager, mock_client, monkeypatch):
        """Test retrieving Bedrock config"""
        monkeypatch.setenv("ENVIRONMENT", "dev")
        mock_config = {
            "modelId": "anthropic.claude-3-5-sonnet",
            "region": "ap-south-1",
        }
        mock_client.get_secret_value.return_value = {
            "SecretString": json.dumps(mock_config)
        }

        result = secrets_manager.get_bedrock_config()

        assert result == mock_config
        mock_client.get_secret_value.assert_called_once_with(
            SecretId="vaidyalink/dev/bedrock/config"
        )

    def test_get_database_credentials(self, secrets_manager, mock_client, monkeypatch):
        """Test retrieving database credentials"""
        monkeypatch.setenv("ENVIRONMENT", "dev")
        mock_creds = {"username": "admin", "password": "secret"}
        mock_client.get_secret_value.return_value = {
            "SecretString": json.dumps(mock_creds)
        }

        result = secrets_manager.get_database_credentials()

        assert result == mock_creds

    def test_get_jwt_signing_secret(self, secrets_manager, mock_client, monkeypatch):
        """Test retrieving JWT signing secret"""
        monkeypatch.setenv("ENVIRONMENT", "dev")
        mock_client.get_secret_value.return_value = {
            "SecretString": "jwt-signing-secret"
        }

        result = secrets_manager.get_jwt_signing_secret()

        assert result == "jwt-signing-secret"

    def test_cache_validity(self, secrets_manager):
        """Test cache validity checking"""
        secrets_manager.cache["test-secret"] = "value"
        secrets_manager.cache_timestamps["test-secret"] = time.time()

        assert secrets_manager._is_cache_valid("test-secret") is True

    def test_cache_expiration(self, secrets_manager):
        """Test cache expiration"""
        secrets_manager.cache["test-secret"] = "value"
        secrets_manager.cache_timestamps["test-secret"] = time.time() - 400  # Expired

        assert secrets_manager._is_cache_valid("test-secret") is False

    def test_clear_specific_cache(self, secrets_manager):
        """Test clearing specific secret cache"""
        secrets_manager.cache["secret1"] = "value1"
        secrets_manager.cache["secret2"] = "value2"

        secrets_manager.clear_cache("secret1")

        assert "secret1" not in secrets_manager.cache
        assert "secret2" in secrets_manager.cache

    def test_clear_all_cache(self, secrets_manager):
        """Test clearing all cache"""
        secrets_manager.cache["secret1"] = "value1"
        secrets_manager.cache["secret2"] = "value2"

        secrets_manager.clear_cache()

        assert len(secrets_manager.cache) == 0

    def test_get_secrets_batch(self, secrets_manager, mock_client):
        """Test batch retrieving multiple secrets"""
        mock_client.get_secret_value.side_effect = [
            {"SecretString": json.dumps({"key1": "value1"})},
            {"SecretString": json.dumps({"key2": "value2"})},
        ]

        result = secrets_manager.get_secrets(["secret1", "secret2"])

        assert result == {"secret1": {"key1": "value1"}, "secret2": {"key2": "value2"}}
        assert mock_client.get_secret_value.call_count == 2

    def test_get_secrets_with_error(self, secrets_manager, mock_client):
        """Test batch get with one secret failing"""
        mock_client.get_secret_value.side_effect = [
            {"SecretString": json.dumps({"key1": "value1"})},
            ClientError(
                {"Error": {"Code": "ResourceNotFoundException"}}, "GetSecretValue"
            ),
        ]

        result = secrets_manager.get_secrets(["secret1", "secret2"])

        assert result["secret1"] == {"key1": "value1"}
        assert result["secret2"] is None


class TestGetInstance:
    def test_singleton_pattern(self):
        """Test that get_instance returns singleton"""
        instance1 = get_instance()
        instance2 = get_instance()

        assert instance1 is instance2

    def test_custom_parameters(self):
        """Test get_instance with custom parameters"""
        instance = get_instance(region="us-east-1", cache_ttl=600)

        assert instance.region == "us-east-1"
        assert instance.cache_ttl == 600
