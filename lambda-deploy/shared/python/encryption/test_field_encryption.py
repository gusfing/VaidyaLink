"""
Unit tests for field-level encryption
"""

import pytest
from unittest.mock import Mock, patch
from field_encryption import FieldEncryption
from kms_encryption import KMSEncryption


@pytest.fixture
def mock_kms():
    """Mock KMS encryption service"""
    kms = Mock(spec=KMSEncryption)
    kms.encrypt = Mock(side_effect=lambda text, ctx: f'encrypted_{text}')
    kms.decrypt = Mock(side_effect=lambda text, ctx: text.replace('encrypted_', ''))
    return kms


@pytest.fixture
def field_encryption(mock_kms):
    """FieldEncryption instance with mocked KMS"""
    return FieldEncryption(mock_kms)


class TestFieldEncryptionInit:
    """Test FieldEncryption initialization"""

    def test_init_with_kms(self, mock_kms):
        """Should initialize with provided KMS instance"""
        field_enc = FieldEncryption(mock_kms)
        assert field_enc.kms == mock_kms

    @patch('field_encryption.KMSEncryption')
    def test_init_without_kms_creates_new(self, mock_kms_class):
        """Should create new KMS instance if not provided"""
        field_enc = FieldEncryption()
        mock_kms_class.assert_called_once()


class TestEncryptRecord:
    """Test record encryption"""

    def test_encrypt_sensitive_fields(self, field_encryption, mock_kms):
        """Should encrypt only sensitive fields"""
        record = {
            'patient_id': '123',
            'patient_name': 'Rajesh Kumar',
            'age': 45,
            'medical_history': 'Diabetes Type 2'
        }

        encrypted = field_encryption.encrypt_record(record, patient_id='123')

        # Sensitive fields should be encrypted
        assert encrypted['patient_name'] == 'encrypted_Rajesh Kumar'
        assert encrypted['patient_name_encrypted'] is True
        assert encrypted['medical_history'] == 'encrypted_Diabetes Type 2'
        assert encrypted['medical_history_encrypted'] is True

        # Non-sensitive fields should remain unchanged
        assert encrypted['patient_id'] == '123'
        assert encrypted['age'] == 45
        assert 'patient_id_encrypted' not in encrypted
        assert 'age_encrypted' not in encrypted

    def test_encrypt_with_patient_id_context(self, field_encryption, mock_kms):
        """Should include patient ID in encryption context"""
        record = {'patient_name': 'John Doe'}

        field_encryption.encrypt_record(record, patient_id='456')

        # Verify KMS was called with correct context
        call_args = mock_kms.encrypt.call_args[0]
        context = call_args[1]
        assert context['patient_id'] == '456'
        assert context['service'] == 'vaidyalink'
        assert context['data_type'] == 'phi'
        assert context['field_name'] == 'patient_name'

    def test_encrypt_with_additional_context(self, field_encryption, mock_kms):
        """Should merge additional context"""
        record = {'patient_name': 'Jane Doe'}
        additional = {'department': 'cardiology', 'doctor_id': '789'}

        field_encryption.encrypt_record(record, additional_context=additional)

        context = mock_kms.encrypt.call_args[0][1]
        assert context['department'] == 'cardiology'
        assert context['doctor_id'] == '789'

    def test_encrypt_null_values_skipped(self, field_encryption, mock_kms):
        """Should skip null values"""
        record = {
            'patient_name': 'Test',
            'medical_history': None
        }

        encrypted = field_encryption.encrypt_record(record)

        # Null field should not be encrypted
        assert encrypted['medical_history'] is None
        assert 'medical_history_encrypted' not in encrypted

        # Non-null field should be encrypted
        assert encrypted['patient_name'] == 'encrypted_Test'

    def test_encrypt_empty_record(self, field_encryption):
        """Should handle empty record"""
        encrypted = field_encryption.encrypt_record({})
        assert encrypted == {}


class TestDecryptRecord:
    """Test record decryption"""

    def test_decrypt_encrypted_fields(self, field_encryption, mock_kms):
        """Should decrypt encrypted fields"""
        encrypted_record = {
            'patient_id': '123',
            'patient_name': 'encrypted_Rajesh Kumar',
            'patient_name_encrypted': True,
            'age': 45,
            'medical_history': 'encrypted_Diabetes',
            'medical_history_encrypted': True
        }

        decrypted = field_encryption.decrypt_record(encrypted_record, patient_id='123')

        # Encrypted fields should be decrypted
        assert decrypted['patient_name'] == 'Rajesh Kumar'
        assert 'patient_name_encrypted' not in decrypted
        assert decrypted['medical_history'] == 'Diabetes'
        assert 'medical_history_encrypted' not in decrypted

        # Non-encrypted fields unchanged
        assert decrypted['patient_id'] == '123'
        assert decrypted['age'] == 45

    def test_decrypt_specific_fields(self, field_encryption, mock_kms):
        """Should decrypt only specified fields"""
        encrypted_record = {
            'patient_name': 'encrypted_John',
            'patient_name_encrypted': True,
            'medical_history': 'encrypted_History',
            'medical_history_encrypted': True
        }

        decrypted = field_encryption.decrypt_record(
            encrypted_record,
            fields_to_decrypt=['patient_name']
        )

        # Only specified field should be decrypted
        assert decrypted['patient_name'] == 'John'
        assert 'patient_name_encrypted' not in decrypted

        # Other encrypted fields remain encrypted
        assert decrypted['medical_history'] == 'encrypted_History'
        assert decrypted['medical_history_encrypted'] is True

    def test_decrypt_with_context(self, field_encryption, mock_kms):
        """Should use correct decryption context"""
        encrypted_record = {
            'patient_name': 'encrypted_Test',
            'patient_name_encrypted': True
        }

        field_encryption.decrypt_record(
            encrypted_record,
            patient_id='789',
            additional_context={'department': 'neurology'}
        )

        context = mock_kms.decrypt.call_args[0][1]
        assert context['patient_id'] == '789'
        assert context['department'] == 'neurology'
        assert context['field_name'] == 'patient_name'

    def test_decrypt_non_encrypted_fields_unchanged(self, field_encryption):
        """Should not modify non-encrypted fields"""
        record = {
            'patient_name': 'Plain Text',
            'age': 30
        }

        decrypted = field_encryption.decrypt_record(record)

        assert decrypted['patient_name'] == 'Plain Text'
        assert decrypted['age'] == 30


class TestEncryptField:
    """Test single field encryption"""

    def test_encrypt_field_success(self, field_encryption, mock_kms):
        """Should encrypt single field"""
        result = field_encryption.encrypt_field(
            'patient_name',
            'Rajesh Kumar',
            patient_id='123'
        )

        assert result == 'encrypted_Rajesh Kumar'

        # Verify context
        context = mock_kms.encrypt.call_args[0][1]
        assert context['field_name'] == 'patient_name'
        assert context['patient_id'] == '123'

    def test_encrypt_field_empty_value_raises_error(self, field_encryption):
        """Should raise error for empty value"""
        with pytest.raises(ValueError, match='Field value cannot be empty'):
            field_encryption.encrypt_field('patient_name', '')

    def test_encrypt_field_with_additional_context(self, field_encryption, mock_kms):
        """Should include additional context"""
        field_encryption.encrypt_field(
            'diagnosis',
            'Hypertension',
            additional_context={'doctor_id': '456'}
        )

        context = mock_kms.encrypt.call_args[0][1]
        assert context['doctor_id'] == '456'


class TestDecryptField:
    """Test single field decryption"""

    def test_decrypt_field_success(self, field_encryption, mock_kms):
        """Should decrypt single field"""
        result = field_encryption.decrypt_field(
            'patient_name',
            'encrypted_Rajesh Kumar',
            patient_id='123'
        )

        assert result == 'Rajesh Kumar'

        # Verify context
        context = mock_kms.decrypt.call_args[0][1]
        assert context['field_name'] == 'patient_name'
        assert context['patient_id'] == '123'

    def test_decrypt_field_empty_value_raises_error(self, field_encryption):
        """Should raise error for empty value"""
        with pytest.raises(ValueError, match='Encrypted value cannot be empty'):
            field_encryption.decrypt_field('patient_name', '')


class TestSensitiveFieldManagement:
    """Test sensitive field management"""

    def test_is_sensitive_field(self, field_encryption):
        """Should identify sensitive fields"""
        assert field_encryption.is_sensitive_field('patient_name') is True
        assert field_encryption.is_sensitive_field('medical_history') is True
        assert field_encryption.is_sensitive_field('age') is False
        assert field_encryption.is_sensitive_field('patient_id') is False

    def test_add_sensitive_field(self, field_encryption):
        """Should add field to sensitive list"""
        assert field_encryption.is_sensitive_field('custom_field') is False

        field_encryption.add_sensitive_field('custom_field')

        assert field_encryption.is_sensitive_field('custom_field') is True

    def test_remove_sensitive_field(self, field_encryption):
        """Should remove field from sensitive list"""
        assert field_encryption.is_sensitive_field('patient_name') is True

        field_encryption.remove_sensitive_field('patient_name')

        assert field_encryption.is_sensitive_field('patient_name') is False

    def test_remove_non_existent_field(self, field_encryption):
        """Should handle removing non-existent field gracefully"""
        # Should not raise error
        field_encryption.remove_sensitive_field('non_existent_field')


class TestIntegration:
    """Integration tests"""

    def test_full_encrypt_decrypt_cycle(self, field_encryption):
        """Should successfully encrypt and decrypt full record"""
        original_record = {
            'patient_id': '123',
            'patient_name': 'Rajesh Kumar',
            'age': 45,
            'medical_history': 'Diabetes Type 2',
            'phone_number': '+91-9876543210'
        }

        # Encrypt
        encrypted = field_encryption.encrypt_record(original_record, patient_id='123')

        # Verify encryption
        assert encrypted['patient_name'] != original_record['patient_name']
        assert encrypted['patient_name_encrypted'] is True
        assert encrypted['age'] == 45  # Non-sensitive unchanged

        # Decrypt
        decrypted = field_encryption.decrypt_record(encrypted, patient_id='123')

        # Verify decryption
        assert decrypted['patient_name'] == original_record['patient_name']
        assert decrypted['medical_history'] == original_record['medical_history']
        assert decrypted['phone_number'] == original_record['phone_number']
        assert 'patient_name_encrypted' not in decrypted

    def test_partial_decryption(self, field_encryption):
        """Should support partial field decryption"""
        record = {
            'patient_name': 'John Doe',
            'medical_history': 'Asthma',
            'phone_number': '1234567890'
        }

        # Encrypt all
        encrypted = field_encryption.encrypt_record(record)

        # Decrypt only name
        partial = field_encryption.decrypt_record(
            encrypted,
            fields_to_decrypt=['patient_name']
        )

        assert partial['patient_name'] == 'John Doe'
        assert partial['medical_history'] != 'Asthma'  # Still encrypted
        assert partial['medical_history_encrypted'] is True
