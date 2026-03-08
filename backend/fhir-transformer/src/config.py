"""
Configuration management for FHIR Transformer Lambda
"""

import os
from typing import Optional


class Config:
    """Configuration class for FHIR Transformer"""

    # AWS Configuration
    AWS_REGION: str = os.environ.get('AWS_REGION', 'ap-south-1')
    AWS_ACCOUNT_ID: str = os.environ.get('AWS_ACCOUNT_ID', '')

    # HealthLake Configuration
    HEALTHLAKE_DATASTORE_ID: str = os.environ.get('HEALTHLAKE_DATASTORE_ID', '')
    HEALTHLAKE_ENDPOINT: str = os.environ.get('HEALTHLAKE_ENDPOINT', 'https://healthlake.ap-south-1.amazonaws.com')
    HEALTHLAKE_API_VERSION: str = os.environ.get('HEALTHLAKE_API_VERSION', 'R4')
    ENABLE_BATCH_OPERATIONS: bool = os.environ.get('ENABLE_BATCH_OPERATIONS', 'true').lower() == 'true'
    MAX_BATCH_SIZE: int = int(os.environ.get('MAX_BATCH_SIZE', '100'))

    # DynamoDB Configuration
    DYNAMODB_SCAN_JOBS_TABLE: str = os.environ.get('DYNAMODB_SCAN_JOBS_TABLE', 'vaidyalink-scan-jobs-prod')
    DYNAMODB_PATIENTS_TABLE: str = os.environ.get('DYNAMODB_PATIENTS_TABLE', 'vaidyalink-patients-prod')
    DYNAMODB_FHIR_MAPPINGS_TABLE: str = os.environ.get('DYNAMODB_FHIR_MAPPINGS_TABLE', 'vaidyalink-fhir-mappings-prod')

    # S3 Configuration
    S3_FHIR_EXPORTS_BUCKET: str = os.environ.get('S3_FHIR_EXPORTS_BUCKET', 'vaidyalink-fhir-exports-prod')
    S3_EXPORTS_PREFIX: str = os.environ.get('S3_EXPORTS_PREFIX', 'exports/')
    ENABLE_EXPORT_VERSIONING: bool = os.environ.get('ENABLE_EXPORT_VERSIONING', 'true').lower() == 'true'

    # FHIR Configuration
    FHIR_VERSION: str = os.environ.get('FHIR_VERSION', 'R4')
    FHIR_VALIDATION_MODE: str = os.environ.get('FHIR_VALIDATION_MODE', 'strict')
    ENABLE_CODE_MAPPING: bool = os.environ.get('ENABLE_CODE_MAPPING', 'true').lower() == 'true'
    ENABLE_DRUG_MAPPING: bool = os.environ.get('ENABLE_DRUG_MAPPING', 'true').lower() == 'true'
    ENABLE_LAB_MAPPING: bool = os.environ.get('ENABLE_LAB_MAPPING', 'true').lower() == 'true'
    ENABLE_PROCEDURE_MAPPING: bool = os.environ.get('ENABLE_PROCEDURE_MAPPING', 'true').lower() == 'true'
    CODE_MAPPING_SERVICE_URL: Optional[str] = os.environ.get('CODE_MAPPING_SERVICE_URL')
    FALLBACK_TO_ORIGINAL_CODES: bool = os.environ.get('FALLBACK_TO_ORIGINAL_CODES', 'true').lower() == 'true'

    # FHIR Resource Configuration
    ORGANIZATION_IDENTIFIER: str = os.environ.get('ORGANIZATION_IDENTIFIER', 'https://vaidyalink.com')
    PRACTITIONER_SYSTEM: str = os.environ.get('PRACTITIONER_SYSTEM', 'https://vaidyalink.com/practitioners')
    PATIENT_IDENTIFIER_SYSTEM: str = os.environ.get('PATIENT_IDENTIFIER_SYSTEM', 'https://vaidyalink.com/patients')
    ABHA_IDENTIFIER_SYSTEM: str = os.environ.get('ABHA_IDENTIFIER_SYSTEM', 'https://abdm.gov.in/abha')
    ENABLE_PATIENT_MATCHING: bool = os.environ.get('ENABLE_PATIENT_MATCHING', 'true').lower() == 'true'
    PATIENT_MATCH_THRESHOLD: float = float(os.environ.get('PATIENT_MATCH_THRESHOLD', '0.90'))

    # Data Quality Configuration
    ENABLE_QUALITY_CHECKS: bool = os.environ.get('ENABLE_QUALITY_CHECKS', 'true').lower() == 'true'
    PATIENT_REQUIRED_FIELDS: list = os.environ.get('PATIENT_REQUIRED_FIELDS', 'name,gender,birthDate').split(',')
    MEDICATION_REQUIRED_FIELDS: list = os.environ.get('MEDICATION_REQUIRED_FIELDS', 'medication,subject,status').split(',')
    ENABLE_DATE_VALIDATION: bool = os.environ.get('ENABLE_DATE_VALIDATION', 'true').lower() == 'true'
    ENABLE_DOSAGE_VALIDATION: bool = os.environ.get('ENABLE_DOSAGE_VALIDATION', 'true').lower() == 'true'
    ENABLE_DRUG_VALIDATION: bool = os.environ.get('ENABLE_DRUG_VALIDATION', 'true').lower() == 'true'
    DRUG_FORMULARY: list = os.environ.get('DRUG_FORMULARY', 'indian_pharmacopoeia,who_essential').split(',')

    # Performance Configuration
    MAX_PROCESSING_TIME: int = int(os.environ.get('MAX_PROCESSING_TIME', '10'))
    ENABLE_PARALLEL_CREATION: bool = os.environ.get('ENABLE_PARALLEL_CREATION', 'true').lower() == 'true'
    MAX_CONCURRENT_OPERATIONS: int = int(os.environ.get('MAX_CONCURRENT_OPERATIONS', '10'))
    ENABLE_RESOURCE_CACHE: bool = os.environ.get('ENABLE_RESOURCE_CACHE', 'true').lower() == 'true'
    CACHE_TTL_SECONDS: int = int(os.environ.get('CACHE_TTL_SECONDS', '300'))

    # Export Configuration
    DEFAULT_EXPORT_FORMAT: str = os.environ.get('DEFAULT_EXPORT_FORMAT', 'json')
    ENABLE_PRETTY_PRINT: bool = os.environ.get('ENABLE_PRETTY_PRINT', 'true').lower() == 'true'
    INCLUDE_NARRATIVE: bool = os.environ.get('INCLUDE_NARRATIVE', 'true').lower() == 'true'
    INCLUDE_CONTAINED_RESOURCES: bool = os.environ.get('INCLUDE_CONTAINED_RESOURCES', 'false').lower() == 'true'

    # Integration Configuration
    ENABLE_ABDM_INTEGRATION: bool = os.environ.get('ENABLE_ABDM_INTEGRATION', 'true').lower() == 'true'
    ABDM_CONNECTOR_LAMBDA_ARN: str = os.environ.get('ABDM_CONNECTOR_LAMBDA_ARN', '')
    ENABLE_AUTO_ABDM_PUSH: bool = os.environ.get('ENABLE_AUTO_ABDM_PUSH', 'false').lower() == 'true'

    # Monitoring and Logging
    LOG_GROUP: str = os.environ.get('LOG_GROUP', '/aws/lambda/vaidyalink-fhir-transformer-prod')
    LOG_LEVEL: str = os.environ.get('LOG_LEVEL', 'INFO')
    ENABLE_XRAY_TRACING: bool = os.environ.get('ENABLE_XRAY_TRACING', 'true').lower() == 'true'
    ENABLE_DETAILED_METRICS: bool = os.environ.get('ENABLE_DETAILED_METRICS', 'true').lower() == 'true'
    ENABLE_FHIR_METRICS: bool = os.environ.get('ENABLE_FHIR_METRICS', 'true').lower() == 'true'

    # Encryption
    KMS_KEY_ID: str = os.environ.get('KMS_KEY_ID', '')
    ENABLE_ENCRYPTION: bool = os.environ.get('ENABLE_ENCRYPTION', 'true').lower() == 'true'

    @classmethod
    def validate(cls) -> None:
        """Validate required configuration"""
        required_vars = [
            'HEALTHLAKE_DATASTORE_ID',
            'AWS_ACCOUNT_ID'
        ]

        missing = [var for var in required_vars if not getattr(cls, var)]
        if missing:
            raise ValueError(f"Missing required environment variables: {', '.join(missing)}")


# Validate configuration on import
try:
    Config.validate()
except ValueError as e:
    import logging
    logging.warning(f"Configuration validation warning: {e}")
