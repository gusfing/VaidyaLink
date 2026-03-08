"""
FHIR Validator

Validates FHIR resources against FHIR R4 specification and profiles.
Supports validation against:
- Base FHIR R4 specification
- ABDM (Ayushman Bharat Digital Mission) profiles
- Custom VaidyaLink profiles
"""

import logging
from typing import Dict, Any, List, Optional
from enum import Enum

logger = logging.getLogger(__name__)


class ProfileType(Enum):
    """Supported FHIR profile types"""
    BASE_R4 = "base-r4"
    ABDM = "abdm"
    VAIDYALINK = "vaidyalink"
    US_CORE = "us-core"


class ValidationError:
    """Represents a FHIR validation error"""

    def __init__(
        self,
        severity: str,
        message: str,
        location: Optional[str] = None,
        code: Optional[str] = None
    ):
        self.severity = severity  # error, warning, information
        self.message = message
        self.location = location
        self.code = code

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "severity": self.severity,
            "message": self.message,
            "location": self.location,
            "code": self.code
        }


class FHIRValidator:
    """
    Validates FHIR resources against FHIR R4 specification and custom profiles.

    Supports multiple validation profiles:
    - Base FHIR R4 specification
    - ABDM (Ayushman Bharat Digital Mission) profiles for Indian healthcare
    - VaidyaLink custom profiles
    - US Core profiles (for medical tourism)
    """

    def __init__(self, profile: ProfileType = ProfileType.BASE_R4):
        """
        Initialize FHIR Validator

        Args:
            profile: Profile type to validate against (default: BASE_R4)
        """
        self.profile = profile
        self.errors = []
        self.warnings = []
        logger.info(f"Initialized FHIR Validator with profile: {profile.value}")

    def validate_resource(self, resource: Any, profile_url: Optional[str] = None) -> bool:
        """
        Validate a FHIR resource against specification and optional profile

        Args:
            resource: FHIR resource object
            profile_url: Optional profile URL to validate against (e.g., ABDM profile)

        Returns:
            True if valid, False otherwise
        """
        try:
            logger.info(f"Validating {resource.get_resource_type()} resource")

            self.errors = []
            self.warnings = []

            # The fhir.resources library performs validation during construction
            # and when calling .dict() or .json()
            # Additional custom validation can be added here

            # Validate required fields based on resource type
            if resource.get_resource_type() == "Patient":
                self._validate_patient(resource)
            elif resource.get_resource_type() == "MedicationStatement":
                self._validate_medication_statement(resource)
            elif resource.get_resource_type() == "Observation":
                self._validate_observation(resource)
            elif resource.get_resource_type() == "Encounter":
                self._validate_encounter(resource)
            elif resource.get_resource_type() == "DiagnosticReport":
                self._validate_diagnostic_report(resource)

            # Validate against profile if specified
            if profile_url:
                self._validate_against_profile(resource, profile_url)
            elif self.profile != ProfileType.BASE_R4:
                # Apply profile-specific validation based on configured profile
                self._apply_profile_validation(resource)

            # Try to serialize to catch any validation errors
            try:
                resource.model_dump(exclude_none=True)
            except Exception as e:
                self.errors.append(
                    ValidationError(
                        severity="error",
                        message=f"Serialization error: {str(e)}",
                        code="serialization-error"
                    )
                )

            is_valid = len(self.errors) == 0
            logger.info(f"Validation result: {'valid' if is_valid else 'invalid'}")

            return is_valid

        except Exception as e:
            logger.error(f"Error during validation: {str(e)}")
            self.errors.append(
                ValidationError(
                    severity="error",
                    message=f"Validation exception: {str(e)}",
                    code="validation-exception"
                )
            )
            return False

    def _validate_patient(self, patient: Any) -> None:
        """Validate Patient resource"""
        # Check for at least one identifier
        if not patient.identifier or len(patient.identifier) == 0:
            self.warnings.append(
                ValidationError(
                    severity="warning",
                    message="Patient should have at least one identifier",
                    location="Patient.identifier"
                )
            )

        # Check for name
        if not patient.name or len(patient.name) == 0:
            self.warnings.append(
                ValidationError(
                    severity="warning",
                    message="Patient should have a name",
                    location="Patient.name"
                )
            )

    def _validate_medication_statement(self, med_statement: Any) -> None:
        """Validate MedicationStatement resource"""
        # Check for medication
        if not med_statement.medication:
            self.errors.append(
                ValidationError(
                    severity="error",
                    message="MedicationStatement must have medication",
                    location="MedicationStatement.medication"
                )
            )

        # Check for subject
        if not med_statement.subject:
            self.errors.append(
                ValidationError(
                    severity="error",
                    message="MedicationStatement must have a subject",
                    location="MedicationStatement.subject"
                )
            )

    def _validate_observation(self, observation: Any) -> None:
        """Validate Observation resource"""
        # Check for code
        if not observation.code:
            self.errors.append(
                ValidationError(
                    severity="error",
                    message="Observation must have a code",
                    location="Observation.code"
                )
            )

        # Check for subject
        if not observation.subject:
            self.errors.append(
                ValidationError(
                    severity="error",
                    message="Observation must have a subject",
                    location="Observation.subject"
                )
            )

    def _validate_encounter(self, encounter: Any) -> None:
        """Validate Encounter resource"""
        # Check for class
        if not encounter.class_fhir:
            self.errors.append(
                ValidationError(
                    severity="error",
                    message="Encounter must have a class",
                    location="Encounter.class"
                )
            )

        # Check for subject
        if not encounter.subject:
            self.errors.append(
                ValidationError(
                    severity="error",
                    message="Encounter must have a subject",
                    location="Encounter.subject"
                )
            )

    def _validate_diagnostic_report(self, report: Any) -> None:
        """Validate DiagnosticReport resource"""
        # Check for code
        if not report.code:
            self.errors.append(
                ValidationError(
                    severity="error",
                    message="DiagnosticReport must have a code",
                    location="DiagnosticReport.code"
                )
            )

        # Check for subject
        if not report.subject:
            self.errors.append(
                ValidationError(
                    severity="error",
                    message="DiagnosticReport must have a subject",
                    location="DiagnosticReport.subject"
                )
            )

    def _validate_against_profile(self, resource: Any, profile_url: str) -> None:
        """
        Validate resource against a specific FHIR profile URL

        Args:
            resource: FHIR resource to validate
            profile_url: Profile URL (e.g., https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient)
        """
        logger.info(f"Validating against profile: {profile_url}")

        # Check if resource declares conformance to the profile
        if hasattr(resource, 'meta') and resource.meta:
            if hasattr(resource.meta, 'profile') and resource.meta.profile:
                if profile_url not in resource.meta.profile:
                    self.warnings.append(
                        ValidationError(
                            severity="warning",
                            message=f"Resource does not declare conformance to profile {profile_url}",
                            location="meta.profile",
                            code="profile-not-declared"
                        )
                    )
            else:
                self.warnings.append(
                    ValidationError(
                        severity="warning",
                        message=f"Resource meta.profile is empty, cannot verify conformance to {profile_url}",
                        location="meta.profile",
                        code="profile-missing"
                    )
                )

        # Apply profile-specific validation rules
        if "abdm" in profile_url.lower() or "ndhm" in profile_url.lower():
            self._validate_abdm_profile(resource)
        elif "vaidyalink" in profile_url.lower():
            self._validate_vaidyalink_profile(resource)
        elif "us-core" in profile_url.lower():
            self._validate_us_core_profile(resource)

    def _apply_profile_validation(self, resource: Any) -> None:
        """
        Apply profile-specific validation based on configured profile type

        Args:
            resource: FHIR resource to validate
        """
        if self.profile == ProfileType.ABDM:
            self._validate_abdm_profile(resource)
        elif self.profile == ProfileType.VAIDYALINK:
            self._validate_vaidyalink_profile(resource)
        elif self.profile == ProfileType.US_CORE:
            self._validate_us_core_profile(resource)

    def _validate_abdm_profile(self, resource: Any) -> None:
        """
        Validate resource against ABDM (Ayushman Bharat Digital Mission) profile requirements

        ABDM profiles require:
        - Patient: Must have ABHA ID identifier
        - All resources: Must have proper Indian code systems (ICD-10, SNOMED CT)
        - Proper consent management metadata
        """
        resource_type = resource.get_resource_type()
        logger.info(f"Applying ABDM profile validation for {resource_type}")

        if resource_type == "Patient":
            # Check for ABHA ID identifier
            has_abha = False
            if resource.identifier:
                for identifier in resource.identifier:
                    if identifier.system and "abdm.gov.in/abha" in identifier.system:
                        has_abha = True
                        break

            if not has_abha:
                self.warnings.append(
                    ValidationError(
                        severity="warning",
                        message="ABDM profile recommends ABHA ID identifier for Patient",
                        location="Patient.identifier",
                        code="abdm-abha-missing"
                    )
                )

            # Check for Indian phone number format
            if resource.telecom:
                for telecom in resource.telecom:
                    if telecom.system == "phone" and telecom.value:
                        if not telecom.value.startswith("+91"):
                            self.warnings.append(
                                ValidationError(
                                    severity="warning",
                                    message="ABDM profile recommends Indian phone numbers with +91 prefix",
                                    location="Patient.telecom",
                                    code="abdm-phone-format"
                                )
                            )

        elif resource_type == "MedicationStatement":
            # Check for proper medication coding (ATC or Indian Pharmacopoeia)
            if hasattr(resource, 'medication') and resource.medication:
                if hasattr(resource.medication, 'concept') and resource.medication.concept:
                    if resource.medication.concept.coding:
                        has_valid_system = False
                        for coding in resource.medication.concept.coding:
                            if coding.system and ("whocc.no/atc" in coding.system or "indianpharmacopoeia" in coding.system):
                                has_valid_system = True
                                break

                        if not has_valid_system:
                            self.warnings.append(
                                ValidationError(
                                    severity="warning",
                                    message="ABDM profile recommends ATC or Indian Pharmacopoeia codes for medications",
                                    location="MedicationStatement.medication.concept.coding",
                                    code="abdm-medication-coding"
                                )
                            )

        elif resource_type == "Observation":
            # Check for LOINC codes for lab observations
            if resource.code and resource.code.coding:
                has_loinc = False
                for coding in resource.code.coding:
                    if coding.system and "loinc.org" in coding.system:
                        has_loinc = True
                        break

                if not has_loinc and resource.category:
                    for cat in resource.category:
                        if cat.coding:
                            for cat_coding in cat.coding:
                                if cat_coding.code == "laboratory":
                                    self.warnings.append(
                                        ValidationError(
                                            severity="warning",
                                            message="ABDM profile recommends LOINC codes for laboratory observations",
                                            location="Observation.code.coding",
                                            code="abdm-loinc-missing"
                                        )
                                    )
                                    break

    def _validate_vaidyalink_profile(self, resource: Any) -> None:
        """
        Validate resource against VaidyaLink custom profile requirements

        VaidyaLink profiles require:
        - Confidence scores in notes for AI-extracted data
        - Extraction date metadata
        - Proper source document references
        """
        resource_type = resource.get_resource_type()
        logger.info(f"Applying VaidyaLink profile validation for {resource_type}")

        # Check for confidence score in notes (for AI-extracted resources)
        if hasattr(resource, 'note') and resource.note:
            has_confidence = False
            for note in resource.note:
                if note.text and "confidence" in note.text.lower():
                    has_confidence = True
                    break

            if not has_confidence:
                self.warnings.append(
                    ValidationError(
                        severity="warning",
                        message="VaidyaLink profile recommends confidence scores for AI-extracted data",
                        location=f"{resource_type}.note",
                        code="vaidyalink-confidence-missing"
                    )
                )

        # Check for proper identifier system
        if hasattr(resource, 'identifier') and resource.identifier:
            has_vaidyalink_id = False
            for identifier in resource.identifier:
                if identifier.system and "vaidyalink.com" in identifier.system:
                    has_vaidyalink_id = True
                    break

            if not has_vaidyalink_id:
                self.warnings.append(
                    ValidationError(
                        severity="warning",
                        message="VaidyaLink profile recommends VaidyaLink system identifier",
                        location=f"{resource_type}.identifier",
                        code="vaidyalink-identifier-missing"
                    )
                )

    def _validate_us_core_profile(self, resource: Any) -> None:
        """
        Validate resource against US Core profile requirements

        US Core profiles are used for medical tourism scenarios where
        Indian patients need records compatible with US healthcare systems.

        US Core requires:
        - Patient: US-specific identifiers and extensions
        - Proper US code systems (CPT, ICD-10-CM, RxNorm)
        - Race and ethnicity extensions (optional for international patients)
        """
        resource_type = resource.get_resource_type()
        logger.info(f"Applying US Core profile validation for {resource_type}")

        if resource_type == "Patient":
            # Check for proper name structure
            if resource.name:
                for name in resource.name:
                    if not name.family:
                        self.warnings.append(
                            ValidationError(
                                severity="warning",
                                message="US Core profile requires family name for Patient",
                                location="Patient.name.family",
                                code="us-core-family-name-missing"
                            )
                        )
                    if not name.given:
                        self.warnings.append(
                            ValidationError(
                                severity="warning",
                                message="US Core profile requires given name for Patient",
                                location="Patient.name.given",
                                code="us-core-given-name-missing"
                            )
                        )

        elif resource_type == "MedicationStatement":
            # Check for RxNorm codes
            if hasattr(resource, 'medication') and resource.medication:
                if hasattr(resource.medication, 'concept') and resource.medication.concept:
                    if resource.medication.concept.coding:
                        has_rxnorm = False
                        for coding in resource.medication.concept.coding:
                            if coding.system and "rxnorm" in coding.system.lower():
                                has_rxnorm = True
                                break

                        if not has_rxnorm:
                            self.warnings.append(
                                ValidationError(
                                    severity="warning",
                                    message="US Core profile recommends RxNorm codes for medications",
                                    location="MedicationStatement.medication.concept.coding",
                                    code="us-core-rxnorm-missing"
                                )
                            )

    def get_errors(self) -> List[Dict[str, Any]]:
        """Get validation errors"""
        return [error.to_dict() for error in self.errors]

    def get_warnings(self) -> List[Dict[str, Any]]:
        """Get validation warnings"""
        return [warning.to_dict() for warning in self.warnings]

    def get_all_issues(self) -> List[Dict[str, Any]]:
        """Get all validation issues (errors and warnings)"""
        return self.get_errors() + self.get_warnings()

    def validate_bundle(self, bundle: Any) -> bool:
        """
        Validate a FHIR Bundle and all contained resources

        Args:
            bundle: FHIR Bundle resource

        Returns:
            True if all resources are valid, False otherwise
        """
        try:
            logger.info(f"Validating Bundle with {len(bundle.entry) if bundle.entry else 0} entries")

            self.errors = []
            self.warnings = []

            # Validate bundle itself
            if not bundle.type:
                self.errors.append(
                    ValidationError(
                        severity="error",
                        message="Bundle must have a type",
                        location="Bundle.type"
                    )
                )

            # Validate each entry
            if bundle.entry:
                for i, entry in enumerate(bundle.entry):
                    if entry.resource:
                        entry_valid = self.validate_resource(entry.resource)
                        if not entry_valid:
                            logger.warning(f"Bundle entry {i} validation failed")

            is_valid = len(self.errors) == 0
            logger.info(f"Bundle validation result: {'valid' if is_valid else 'invalid'}")

            return is_valid

        except Exception as e:
            logger.error(f"Error validating bundle: {str(e)}")
            self.errors.append(
                ValidationError(
                    severity="error",
                    message=f"Bundle validation exception: {str(e)}",
                    code="bundle-validation-exception"
                )
            )
            return False
