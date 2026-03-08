"""
Field-Level Encryption for PHI Data
Encrypts specific fields in patient records using KMS
"""

from typing import Dict, Any, List, Optional
from .kms_encryption import KMSEncryption


class FieldEncryption:
    """
    Field-level encryption service for PHI data

    Encrypts sensitive fields in patient records while keeping
    non-sensitive fields in plaintext for querying and indexing.
    """

    # Fields that require encryption (PHI data)
    # Based on HIPAA requirements and VaidyaLink data models
    SENSITIVE_FIELDS = {
        # Patient Demographics (Patient table)
        'patient_name',
        'name',
        'abha_id',
        'phone_number',
        'phone',
        'email',
        'address',
        'date_of_birth',
        'dateOfBirth',
        'emergency_contact',
        'emergencyContact',

        # Medical Information (ScanJobs, VoiceJobs)
        'medical_history',
        'medicalHistory',
        'diagnosis',
        'prescription_details',
        'prescriptionDetails',
        'lab_results',
        'labResults',
        'doctor_notes',
        'doctorNotes',
        'extracted_data',
        'extractedData',
        'transcription',
        'transcribed_text',
        'transcribedText',

        # Insurance and Financial
        'insurance_details',
        'insuranceDetails',

        # Other PHI
        'clinical_notes',
        'clinicalNotes',
        'treatment_plan',
        'treatmentPlan',
        'medication_list',
        'medicationList'
    }

    def __init__(self, kms_encryption: Optional[KMSEncryption] = None):
        """
        Initialize field encryption service

        Args:
            kms_encryption: Optional KMSEncryption instance (creates new if not provided)
        """
        self.kms = kms_encryption or KMSEncryption()

    def encrypt_record(
        self,
        record: Dict[str, Any],
        patient_id: Optional[str] = None,
        additional_context: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Encrypt sensitive fields in a record

        Args:
            record: Dictionary containing patient data
            patient_id: Optional patient ID for encryption context
            additional_context: Additional encryption context key-value pairs

        Returns:
            Record with sensitive fields encrypted

        Example:
            >>> record = {
            ...     'patient_id': '123',
            ...     'patient_name': 'Rajesh Kumar',
            ...     'age': 45,
            ...     'medical_history': 'Diabetes Type 2'
            ... }
            >>> encrypted = field_enc.encrypt_record(record, patient_id='123')
            >>> # patient_name and medical_history are encrypted, age remains plaintext
        """
        encrypted_record = record.copy()

        # Build encryption context
        encryption_context = {
            'service': 'vaidyalink',
            'data_type': 'phi'
        }

        if patient_id:
            encryption_context['patient_id'] = patient_id

        if additional_context:
            encryption_context.update(additional_context)

        # Encrypt sensitive fields
        for field_name, field_value in record.items():
            if field_name in self.SENSITIVE_FIELDS and field_value is not None:
                # Convert to string if not already
                plaintext = str(field_value)

                # Add field name to context for audit trail
                field_context = encryption_context.copy()
                field_context['field_name'] = field_name

                # Encrypt the field
                encrypted_value = self.kms.encrypt(plaintext, field_context)
                encrypted_record[field_name] = encrypted_value

                # Mark field as encrypted
                encrypted_record[f'{field_name}_encrypted'] = True

        return encrypted_record

    def decrypt_record(
        self,
        encrypted_record: Dict[str, Any],
        patient_id: Optional[str] = None,
        additional_context: Optional[Dict[str, str]] = None,
        fields_to_decrypt: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Decrypt sensitive fields in a record

        Args:
            encrypted_record: Dictionary with encrypted fields
            patient_id: Optional patient ID (must match encryption context)
            additional_context: Additional context (must match encryption)
            fields_to_decrypt: Optional list of specific fields to decrypt (decrypts all if None)

        Returns:
            Record with sensitive fields decrypted

        Example:
            >>> decrypted = field_enc.decrypt_record(encrypted_record, patient_id='123')
            >>> # All encrypted fields are decrypted
            >>>
            >>> # Decrypt only specific fields
            >>> partial = field_enc.decrypt_record(
            ...     encrypted_record,
            ...     patient_id='123',
            ...     fields_to_decrypt=['patient_name']
            ... )
        """
        decrypted_record = encrypted_record.copy()

        # Build encryption context
        encryption_context = {
            'service': 'vaidyalink',
            'data_type': 'phi'
        }

        if patient_id:
            encryption_context['patient_id'] = patient_id

        if additional_context:
            encryption_context.update(additional_context)

        # Decrypt fields
        for field_name, field_value in encrypted_record.items():
            # Check if field is marked as encrypted
            is_encrypted = encrypted_record.get(f'{field_name}_encrypted', False)

            # Skip if not encrypted or not in fields to decrypt
            if not is_encrypted:
                continue

            if fields_to_decrypt and field_name not in fields_to_decrypt:
                continue

            if field_value is not None:
                # Add field name to context
                field_context = encryption_context.copy()
                field_context['field_name'] = field_name

                # Decrypt the field
                decrypted_value = self.kms.decrypt(field_value, field_context)
                decrypted_record[field_name] = decrypted_value

                # Remove encryption marker
                decrypted_record.pop(f'{field_name}_encrypted', None)

        return decrypted_record

    def encrypt_field(
        self,
        field_name: str,
        field_value: str,
        patient_id: Optional[str] = None,
        additional_context: Optional[Dict[str, str]] = None
    ) -> str:
        """
        Encrypt a single field value

        Args:
            field_name: Name of the field being encrypted
            field_value: Value to encrypt
            patient_id: Optional patient ID for context
            additional_context: Additional encryption context

        Returns:
            Encrypted field value
        """
        if not field_value:
            raise ValueError('Field value cannot be empty')

        # Build encryption context
        encryption_context = {
            'service': 'vaidyalink',
            'data_type': 'phi',
            'field_name': field_name
        }

        if patient_id:
            encryption_context['patient_id'] = patient_id

        if additional_context:
            encryption_context.update(additional_context)

        return self.kms.encrypt(str(field_value), encryption_context)

    def decrypt_field(
        self,
        field_name: str,
        encrypted_value: str,
        patient_id: Optional[str] = None,
        additional_context: Optional[Dict[str, str]] = None
    ) -> str:
        """
        Decrypt a single field value

        Args:
            field_name: Name of the field being decrypted
            encrypted_value: Encrypted value
            patient_id: Optional patient ID (must match encryption context)
            additional_context: Additional context (must match encryption)

        Returns:
            Decrypted field value
        """
        if not encrypted_value:
            raise ValueError('Encrypted value cannot be empty')

        # Build encryption context (must match encryption)
        encryption_context = {
            'service': 'vaidyalink',
            'data_type': 'phi',
            'field_name': field_name
        }

        if patient_id:
            encryption_context['patient_id'] = patient_id

        if additional_context:
            encryption_context.update(additional_context)

        return self.kms.decrypt(encrypted_value, encryption_context)

    def is_sensitive_field(self, field_name: str) -> bool:
        """
        Check if a field should be encrypted

        Args:
            field_name: Name of the field to check

        Returns:
            True if field is sensitive and should be encrypted
        """
        return field_name in self.SENSITIVE_FIELDS

    def add_sensitive_field(self, field_name: str) -> None:
        """
        Add a field to the sensitive fields list

        Args:
            field_name: Name of the field to mark as sensitive
        """
        self.SENSITIVE_FIELDS.add(field_name)

    def remove_sensitive_field(self, field_name: str) -> None:
        """
        Remove a field from the sensitive fields list

        Args:
            field_name: Name of the field to unmark as sensitive
        """
        self.SENSITIVE_FIELDS.discard(field_name)
