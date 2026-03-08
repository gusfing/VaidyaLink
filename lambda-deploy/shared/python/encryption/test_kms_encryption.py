"""
Unit tests for KMS encryption utilities
"""

import os
import base64
import pytest
from unittest.mock import Mock, patch, MagicMock
from botocore.exceptions import ClientError
from kms_encryption import KMSEncryption


@pytest.fixture
def mock_kms_client():
    """Mock KMS client for testing"""
    with patch('kms_encryption.boto3.client') as mock_client:
        yield mock_client.return_value


@pytest.fixture
def kms_encryption(mock_kms_client):
    """KMSEncryption instance with mocked client"""
    with patch.dict(os.environ, {'VAIDYALINK_KMS_KEY_ID': 'test-key-id'}):
        return KMSEncryption()


class TestKMSEncryptionInit:
    """Test KMSEncryption initialization"""

    def test_init_with_config(self):
        """Should initialize with provided config"""
        config = {
            'key_id': 'custom-key-id',
            'region': 'us-east-1'
        }
        kms = KMSEncryption(config)
        assert kms.key_id == 'custom-key-id'
        assert kms.region == 'us-east-1'

    def test_init_with_env_vars(self):
        """Should initialize with environment variables"""
        with patch.dict(os.environ, {
            'VAIDYALINK_KMS_KEY_ID': 'env-key-id',
            'AWS_REGION': 'ap-south-1'
        }):
            kms = KMSEncryption()
            assert kms.key_id == 'env-key-id'
            assert kms.region == 'ap-south-1'

    def test_init_without_key_id_raises_error(self):
        """Should raise error if key ID is not provided"""
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(ValueError, match='KMS key ID is required'):
                KMSEncryption()

    def test_init_defaults_to_ap_south_1(self):
        """Should default to ap-south-1 region"""
        with patch.dict(os.environ, {'VAIDYALINK_KMS_KEY_ID': 'test-key'}):
            kms = KMSEncryption()
            assert kms.region == 'ap-south-1'


class TestEncrypt:
    """Test encryption functionality"""

    def test_encrypt_success(self, kms_encryption, mock_kms_client):
        """Should encrypt plaintext successfully"""
        # Mock KMS response
        mock_kms_client.encrypt.return_value = {
            'CiphertextBlob': b'encrypted_data'
        }

        result = kms_encryption.encrypt('sensitive data')

        # Verify KMS was called correctly
        mock_kms_client.encrypt.assert_called_once()
        call_args = mock_kms_client.encrypt.call_args[1]
        assert call_args['KeyId'] == 'test-key-id'
        assert call_args['Plaintext'] == b'sensitive data'

        # Verify result is base64 encoded
        assert result == base64.b64encode(b'encrypted_data').decode('utf-8')

    def test_encrypt_with_context(self, kms_encryption, mock_kms_client):
        """Should encrypt with encryption context"""
        mock_kms_client.encrypt.return_value = {
            'CiphertextBlob': b'encrypted_data'
        }

        context = {'patient_id': '123', 'data_type': 'medical_history'}
        kms_encryption.encrypt('data', context)

        call_args = mock_kms_client.encrypt.call_args[1]
        assert call_args['EncryptionContext'] == context

    def test_encrypt_empty_plaintext_raises_error(self, kms_encryption):
        """Should raise error for empty plaintext"""
        with pytest.raises(ValueError, match='Plaintext cannot be empty'):
            kms_encryption.encrypt('')

    def test_encrypt_kms_error(self, kms_encryption, mock_kms_client):
        """Should handle KMS errors"""
        mock_kms_client.encrypt.side_effect = ClientError(
            {'Error': {'Code': 'AccessDenied', 'Message': 'Access denied'}},
            'Encrypt'
        )

        with pytest.raises(Exception, match='KMS encryption failed.*AccessDenied'):
            kms_encryption.encrypt('data')


class TestDecrypt:
    """Test decryption functionality"""

    def test_decrypt_success(self, kms_encryption, mock_kms_client):
        """Should decrypt ciphertext successfully"""
        # Mock KMS response
        mock_kms_client.decrypt.return_value = {
            'Plaintext': b'decrypted data'
        }

        ciphertext = base64.b64encode(b'encrypted_data').decode('utf-8')
        result = kms_encryption.decrypt(ciphertext)

        # Verify KMS was called correctly
        mock_kms_client.decrypt.assert_called_once()
        call_args = mock_kms_client.decrypt.call_args[1]
        assert call_args['CiphertextBlob'] == b'encrypted_data'

        assert result == 'decrypted data'

    def test_decrypt_with_context(self, kms_encryption, mock_kms_client):
        """Should decrypt with encryption context"""
        mock_kms_client.decrypt.return_value = {
            'Plaintext': b'decrypted data'
        }

        context = {'patient_id': '123'}
        ciphertext = base64.b64encode(b'encrypted').decode('utf-8')
        kms_encryption.decrypt(ciphertext, context)

        call_args = mock_kms_client.decrypt.call_args[1]
        assert call_args['EncryptionContext'] == context

    def test_decrypt_empty_ciphertext_raises_error(self, kms_encryption):
        """Should raise error for empty ciphertext"""
        with pytest.raises(ValueError, match='Ciphertext cannot be empty'):
            kms_encryption.decrypt('')

    def test_decrypt_invalid_base64_raises_error(self, kms_encryption):
        """Should raise error for invalid base64"""
        with pytest.raises(ValueError, match='Invalid base64-encoded ciphertext'):
            kms_encryption.decrypt('not-valid-base64!!!')

    def test_decrypt_kms_error(self, kms_encryption, mock_kms_client):
        """Should handle KMS errors"""
        mock_kms_client.decrypt.side_effect = ClientError(
            {'Error': {'Code': 'InvalidCiphertextException', 'Message': 'Invalid ciphertext'}},
            'Decrypt'
        )

        ciphertext = base64.b64encode(b'data').decode('utf-8')
        with pytest.raises(Exception, match='KMS decryption failed.*InvalidCiphertextException'):
            kms_encryption.decrypt(ciphertext)


class TestGenerateDataKey:
    """Test data key generation"""

    def test_generate_data_key_success(self, kms_encryption, mock_kms_client):
        """Should generate data key successfully"""
        mock_kms_client.generate_data_key.return_value = {
            'Plaintext': b'plaintext_key',
            'CiphertextBlob': b'encrypted_key'
        }

        result = kms_encryption.generate_data_key()

        mock_kms_client.generate_data_key.assert_called_once()
        assert result['plaintext'] == b'plaintext_key'
        assert result['ciphertext'] == b'encrypted_key'

    def test_generate_data_key_with_context(self, kms_encryption, mock_kms_client):
        """Should generate data key with encryption context"""
        mock_kms_client.generate_data_key.return_value = {
            'Plaintext': b'key',
            'CiphertextBlob': b'encrypted_key'
        }

        context = {'purpose': 'file_encryption'}
        kms_encryption.generate_data_key('AES_128', context)

        call_args = mock_kms_client.generate_data_key.call_args[1]
        assert call_args['KeySpec'] == 'AES_128'
        assert call_args['EncryptionContext'] == context


class TestReEncrypt:
    """Test re-encryption functionality"""

    def test_re_encrypt_success(self, kms_encryption, mock_kms_client):
        """Should re-encrypt with new key"""
        mock_kms_client.re_encrypt.return_value = {
            'CiphertextBlob': b'new_encrypted_data'
        }

        ciphertext = base64.b64encode(b'old_encrypted').decode('utf-8')
        result = kms_encryption.re_encrypt(ciphertext, 'new-key-id')

        mock_kms_client.re_encrypt.assert_called_once()
        call_args = mock_kms_client.re_encrypt.call_args[1]
        assert call_args['DestinationKeyId'] == 'new-key-id'

        assert result == base64.b64encode(b'new_encrypted_data').decode('utf-8')

    def test_re_encrypt_with_contexts(self, kms_encryption, mock_kms_client):
        """Should re-encrypt with source and destination contexts"""
        mock_kms_client.re_encrypt.return_value = {
            'CiphertextBlob': b'new_encrypted'
        }

        ciphertext = base64.b64encode(b'data').decode('utf-8')
        source_ctx = {'old': 'context'}
        dest_ctx = {'new': 'context'}

        kms_encryption.re_encrypt(ciphertext, 'new-key', source_ctx, dest_ctx)

        call_args = mock_kms_client.re_encrypt.call_args[1]
        assert call_args['SourceEncryptionContext'] == source_ctx
        assert call_args['DestinationEncryptionContext'] == dest_ctx


class TestIntegration:
    """Integration tests for encrypt/decrypt cycle"""

    def test_encrypt_decrypt_cycle(self, kms_encryption, mock_kms_client):
        """Should successfully encrypt and decrypt data"""
        plaintext = 'sensitive patient data'
        encrypted_blob = b'encrypted_blob'

        # Mock encrypt
        mock_kms_client.encrypt.return_value = {
            'CiphertextBlob': encrypted_blob
        }

        # Mock decrypt
        mock_kms_client.decrypt.return_value = {
            'Plaintext': plaintext.encode('utf-8')
        }

        # Encrypt
        ciphertext = kms_encryption.encrypt(plaintext)

        # Decrypt
        decrypted = kms_encryption.decrypt(ciphertext)

        assert decrypted == plaintext

    def test_encrypt_decrypt_with_context(self, kms_encryption, mock_kms_client):
        """Should encrypt and decrypt with matching context"""
        plaintext = 'medical history'
        context = {'patient_id': '123', 'field': 'history'}

        mock_kms_client.encrypt.return_value = {
            'CiphertextBlob': b'encrypted'
        }
        mock_kms_client.decrypt.return_value = {
            'Plaintext': plaintext.encode('utf-8')
        }

        ciphertext = kms_encryption.encrypt(plaintext, context)
        decrypted = kms_encryption.decrypt(ciphertext, context)

        assert decrypted == plaintext
