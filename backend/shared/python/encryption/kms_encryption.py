"""
AWS KMS Encryption Utility for VaidyaLink
Provides encryption/decryption using AWS KMS customer-managed keys
HIPAA-compliant encryption for PHI data
"""

import os
import base64
from typing import Optional, Dict, Any
import boto3
from botocore.exceptions import ClientError


class KMSEncryption:
    """
    KMS-based encryption service for sensitive data

    Uses AWS KMS customer-managed keys for encryption/decryption operations.
    Supports encryption context for additional security and audit trails.
    """

    def __init__(self, config: Optional[Dict[str, str]] = None):
        """
        Initialize KMS encryption service

        Args:
            config: Optional configuration dictionary with:
                - key_id: KMS key ID or alias (default: from env VAIDYALINK_KMS_KEY_ID)
                - region: AWS region (default: from env AWS_REGION or ap-south-1)
        """
        config = config or {}
        self.region = config.get('region') or os.environ.get('AWS_REGION', 'ap-south-1')
        self.key_id = config.get('key_id') or os.environ.get('VAIDYALINK_KMS_KEY_ID')

        if not self.key_id:
            raise ValueError('KMS key ID is required. Set VAIDYALINK_KMS_KEY_ID environment variable.')

        # Initialize KMS client
        self.kms_client = boto3.client('kms', region_name=self.region)

    def encrypt(
        self,
        plaintext: str,
        encryption_context: Optional[Dict[str, str]] = None
    ) -> str:
        """
        Encrypt plaintext using KMS

        Args:
            plaintext: The data to encrypt
            encryption_context: Optional key-value pairs for additional authenticated data
                               Example: {'patient_id': '123', 'data_type': 'medical_history'}

        Returns:
            Base64-encoded ciphertext

        Raises:
            ValueError: If plaintext is empty
            ClientError: If KMS operation fails
        """
        if not plaintext:
            raise ValueError('Plaintext cannot be empty')

        try:
            # Convert string to bytes
            plaintext_bytes = plaintext.encode('utf-8')

            # Prepare encryption parameters
            encrypt_params = {
                'KeyId': self.key_id,
                'Plaintext': plaintext_bytes
            }

            # Add encryption context if provided
            if encryption_context:
                encrypt_params['EncryptionContext'] = encryption_context

            # Encrypt using KMS
            response = self.kms_client.encrypt(**encrypt_params)

            # Return base64-encoded ciphertext
            ciphertext_blob = response['CiphertextBlob']
            return base64.b64encode(ciphertext_blob).decode('utf-8')

        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            raise Exception(f'KMS encryption failed [{error_code}]: {error_message}')

    def decrypt(
        self,
        ciphertext: str,
        encryption_context: Optional[Dict[str, str]] = None
    ) -> str:
        """
        Decrypt ciphertext using KMS

        Args:
            ciphertext: Base64-encoded encrypted data
            encryption_context: Must match the context used during encryption

        Returns:
            Decrypted plaintext string

        Raises:
            ValueError: If ciphertext is empty or invalid
            ClientError: If KMS operation fails or encryption context doesn't match
        """
        if not ciphertext:
            raise ValueError('Ciphertext cannot be empty')

        try:
            # Decode base64 ciphertext
            ciphertext_blob = base64.b64decode(ciphertext)

            # Prepare decryption parameters
            decrypt_params = {
                'CiphertextBlob': ciphertext_blob
            }

            # Add encryption context if provided
            if encryption_context:
                decrypt_params['EncryptionContext'] = encryption_context

            # Decrypt using KMS
            response = self.kms_client.decrypt(**decrypt_params)

            # Return decrypted plaintext
            plaintext_bytes = response['Plaintext']
            return plaintext_bytes.decode('utf-8')

        except base64.binascii.Error:
            raise ValueError('Invalid base64-encoded ciphertext')
        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            raise Exception(f'KMS decryption failed [{error_code}]: {error_message}')

    def generate_data_key(
        self,
        key_spec: str = 'AES_256',
        encryption_context: Optional[Dict[str, str]] = None
    ) -> Dict[str, bytes]:
        """
        Generate a data encryption key for envelope encryption

        Args:
            key_spec: Key specification (AES_256 or AES_128)
            encryption_context: Optional context for the data key

        Returns:
            Dictionary with 'plaintext' and 'ciphertext' data keys

        Note:
            Use this for encrypting large amounts of data locally.
            Encrypt data with plaintext key, store encrypted data with ciphertext key.
        """
        try:
            params = {
                'KeyId': self.key_id,
                'KeySpec': key_spec
            }

            if encryption_context:
                params['EncryptionContext'] = encryption_context

            response = self.kms_client.generate_data_key(**params)

            return {
                'plaintext': response['Plaintext'],
                'ciphertext': response['CiphertextBlob']
            }

        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            raise Exception(f'Data key generation failed [{error_code}]: {error_message}')

    def re_encrypt(
        self,
        ciphertext: str,
        destination_key_id: str,
        source_encryption_context: Optional[Dict[str, str]] = None,
        destination_encryption_context: Optional[Dict[str, str]] = None
    ) -> str:
        """
        Re-encrypt data with a different KMS key (for key rotation)

        Args:
            ciphertext: Base64-encoded data encrypted with old key
            destination_key_id: New KMS key ID or alias
            source_encryption_context: Context used with original encryption
            destination_encryption_context: Context for new encryption

        Returns:
            Base64-encoded ciphertext encrypted with new key
        """
        try:
            ciphertext_blob = base64.b64decode(ciphertext)

            params = {
                'CiphertextBlob': ciphertext_blob,
                'DestinationKeyId': destination_key_id
            }

            if source_encryption_context:
                params['SourceEncryptionContext'] = source_encryption_context
            if destination_encryption_context:
                params['DestinationEncryptionContext'] = destination_encryption_context

            response = self.kms_client.re_encrypt(**params)

            return base64.b64encode(response['CiphertextBlob']).decode('utf-8')

        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            raise Exception(f'KMS re-encryption failed [{error_code}]: {error_message}')
