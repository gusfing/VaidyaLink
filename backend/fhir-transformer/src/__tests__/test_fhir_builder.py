"""
Tests for FHIR Resource Builder
"""

import pytest
import sys
from pathlib import Path
from datetime import datetime

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.fhir_builder import FHIRResourceBuilder


class TestFHIRResourceBuilder:
    """Test suite for FHIRResourceBuilder"""

    def setup_method(self):
        """Set up test fixtures"""
        self.builder = FHIRResourceBuilder()

    def test_create_patient_basic(self):
        """Test creating a basic Patient resource"""
        patient_data = {
            "patientId": "patient-123",
            "name": "Rajesh Kumar",
            "gender": "male",
            "birthDate": "1985-06-15"
        }

        patient = self.builder.create_patient(patient_data)

        assert patient.get_resource_type() == "Patient"
        assert len(patient.identifier) == 1
        assert patient.identifier[0].value == "patient-123"
        assert patient.name[0].text == "Rajesh Kumar"
        assert patient.gender == "male"
        assert str(patient.birthDate) == "1985-06-15"

    def test_create_patient_with_abha(self):
        """Test creating Patient with ABHA ID"""
        patient_data = {
            "patientId": "patient-123",
            "abhaId": "12-3456-7890-1234",
            "name": "Priya Sharma",
            "gender": "female",
            "birthDate": "1990-03-20"
        }

        patient = self.builder.create_patient(patient_data)

        assert len(patient.identifier) == 2
        abha_identifier = next(
            (id for id in patient.identifier if id.system == "https://abdm.gov.in/abha"),
            None
        )
        assert abha_identifier is not None
        assert abha_identifier.value == "12-3456-7890-1234"

    def test_create_patient_with_contact(self):
        """Test creating Patient with contact information"""
        patient_data = {
            "patientId": "patient-123",
            "name": "Amit Patel",
            "gender": "male",
            "birthDate": "1988-11-10",
            "phone": "+91-9876543210",
            "email": "amit@example.com"
        }

        patient = self.builder.create_patient(patient_data)

        assert len(patient.telecom) == 2
        phone = next((t for t in patient.telecom if t.system == "phone"), None)
        email = next((t for t in patient.telecom if t.system == "email"), None)
        assert phone.value == "+91-9876543210"
        assert email.value == "amit@example.com"

    def test_create_patient_with_address(self):
        """Test creating Patient with address"""
        patient_data = {
            "patientId": "patient-123",
            "name": "Sunita Reddy",
            "gender": "female",
            "birthDate": "1992-07-25",
            "address": {
                "line": "123 MG Road",
                "city": "Mumbai",
                "state": "Maharashtra",
                "postalCode": "400001",
                "country": "IN"
            }
        }

        patient = self.builder.create_patient(patient_data)

        assert len(patient.address) == 1
        assert patient.address[0].city == "Mumbai"
        assert patient.address[0].state == "Maharashtra"
        assert patient.address[0].country == "IN"

    def test_create_medication_statement(self):
        """Test creating MedicationStatement resource"""
        medication_data = {
            "text": "Omeprazole 20mg",
            "code": "A02BC01",
            "display": "Omeprazole",
            "codeSystem": "http://www.whocc.no/atc",
            "status": "active",
            "effectiveStart": "2024-01-15",
            "dosage": {
                "text": "One capsule daily before breakfast",
                "doseValue": 20,
                "doseUnit": "mg",
                "frequency": 1,
                "period": 1,
                "periodUnit": "d",
                "routeCode": "26643006",
                "routeDisplay": "Oral route"
            },
            "confidence": 0.92,
            "extractionDate": "2024-01-15",
            "note": "Extracted from prescription"
        }

        med_statement = self.builder.create_medication_statement(
            medication_data,
            "Patient/patient-123"
        )

        assert med_statement.get_resource_type() == "MedicationStatement"
        assert med_statement.status == "active"
        assert med_statement.medication.concept.text == "Omeprazole 20mg"
        assert med_statement.subject.reference == "Patient/patient-123"
        assert len(med_statement.dosage) == 1
        assert med_statement.dosage[0].text == "One capsule daily before breakfast"
        assert med_statement.dosage[0].timing is not None
        assert med_statement.dosage[0].timing.repeat.frequency == 1
        assert med_statement.dosage[0].timing.repeat.period == 1
        assert med_statement.dosage[0].timing.repeat.periodUnit == "d"
        assert len(med_statement.note) == 1
        assert "Confidence: 92%" in med_statement.note[0].text

    def test_create_medication_statement_with_mapping(self):
        """Test creating MedicationStatement with automatic ATC code mapping"""
        medication_data = {
            "medicationName": "Paracetamol",
            "status": "active",
            "effectiveStart": "2024-01-15",
            "dosage": {
                "text": "500mg every 6 hours",
                "doseValue": 500,
                "doseUnit": "mg",
                "frequency": 4,
                "period": 1,
                "periodUnit": "d"
            },
            "confidence": 0.88
        }

        med_statement = self.builder.create_medication_statement(
            medication_data,
            "Patient/patient-123"
        )

        assert med_statement.get_resource_type() == "MedicationStatement"
        # Check that ATC code was mapped
        assert med_statement.medication.concept.coding is not None
        assert len(med_statement.medication.concept.coding) > 0
        assert med_statement.medication.concept.coding[0].system == "http://www.whocc.no/atc"
        assert med_statement.medication.concept.coding[0].code == "N02BE01"
        assert "Confidence: 88%" in med_statement.note[0].text

    def test_create_medication_statement_minimal(self):
        """Test creating MedicationStatement with minimal data"""
        medication_data = {
            "medicationName": "Aspirin",
            "status": "active"
        }

        med_statement = self.builder.create_medication_statement(
            medication_data,
            "Patient/patient-123"
        )

        assert med_statement.get_resource_type() == "MedicationStatement"
        assert med_statement.status == "active"
        assert med_statement.subject.reference == "Patient/patient-123"
        assert med_statement.medication.concept.text == "Aspirin"

    def test_create_medication_statement_with_period(self):
        """Test creating MedicationStatement with effective period"""
        medication_data = {
            "medicationName": "Metformin",
            "status": "active",
            "effectiveStart": "2024-01-01",
            "effectiveEnd": "2024-12-31",
            "dosage": {
                "text": "500mg twice daily with meals",
                "doseValue": 500,
                "doseUnit": "mg",
                "frequency": 2,
                "period": 1,
                "periodUnit": "d"
            }
        }

        med_statement = self.builder.create_medication_statement(
            medication_data,
            "Patient/patient-123"
        )

        assert med_statement.effectivePeriod is not None
        assert str(med_statement.effectivePeriod.start) == "2024-01-01"
        assert str(med_statement.effectivePeriod.end) == "2024-12-31"

    def test_create_observation(self):
        """Test creating Observation resource"""
        observation_data = {
            "text": "Blood Glucose",
            "code": "2339-0",
            "display": "Glucose [Mass/volume] in Blood",
            "codeSystem": "http://loinc.org",
            "status": "final",
            "effectiveDateTime": "2024-01-15T10:30:00Z",
            "valueQuantity": {
                "value": 95,
                "unit": "mg/dL",
                "code": "mg/dL"
            },
            "note": "Fasting blood glucose"
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.status == "final"
        assert observation.code.text == "Blood Glucose"
        assert observation.subject.reference == "Patient/patient-123"
        assert observation.valueQuantity.value == 95
        assert observation.valueQuantity.unit == "mg/dL"
    def test_create_observation_vital_signs(self):
        """Test creating Observation for vital signs"""
        observation_data = {
            "observationName": "Blood Pressure",
            "category": "vital-signs",
            "categoryDisplay": "Vital Signs",
            "status": "final",
            "effectiveDateTime": "2024-01-15T10:30:00Z",
            "valueQuantity": {
                "value": 120,
                "unit": "mmHg",
                "code": "mm[Hg]"
            },
            "referenceRange": {
                "low": 90,
                "high": 140,
                "unit": "mmHg",
                "text": "Normal range"
            },
            "interpretation": "N",
            "interpretationDisplay": "Normal",
            "confidence": 0.95
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.status == "final"
        assert observation.category is not None
        assert len(observation.category) == 1
        assert observation.category[0].coding[0].code == "vital-signs"
        assert observation.code.text == "Blood Pressure"
        assert observation.code.coding[0].code == "85354-9"  # LOINC code
        assert observation.valueQuantity.value == 120
        assert observation.valueQuantity.unit == "mmHg"
        assert observation.referenceRange is not None
        assert len(observation.referenceRange) == 1
        assert observation.referenceRange[0].low.value == 90
        assert observation.referenceRange[0].high.value == 140
        assert observation.interpretation is not None
        assert observation.interpretation[0].coding[0].code == "N"
        assert "Confidence: 95%" in observation.note[0].text

    def test_create_observation_lab_result(self):
        """Test creating Observation for lab result"""
        observation_data = {
            "observationName": "Blood Glucose",
            "category": "laboratory",
            "status": "final",
            "effectiveDateTime": "2024-01-15T08:00:00Z",
            "valueQuantity": {
                "value": 95,
                "unit": "mg/dL",
                "code": "mg/dL"
            },
            "referenceRange": {
                "low": 70,
                "high": 100,
                "unit": "mg/dL",
                "text": "Fasting glucose normal range"
            },
            "interpretation": "N",
            "note": "Fasting blood glucose test",
            "confidence": 0.92,
            "extractionDate": "2024-01-15"
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.code.coding[0].code == "2339-0"  # LOINC for blood glucose
        assert observation.valueQuantity.value == 95
        assert "Confidence: 92%" in observation.note[0].text
        assert "Extraction date: 2024-01-15" in observation.note[0].text

    def test_create_observation_string_value(self):
        """Test creating Observation with string value"""
        observation_data = {
            "text": "Blood Type",
            "code": "883-9",
            "display": "ABO group [Type] in Blood",
            "status": "final",
            "effectiveDateTime": "2024-01-15T10:00:00Z",
            "valueString": "A+"
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.valueString == "A+"
        assert observation.valueQuantity is None

    def test_create_observation_codeable_concept_value(self):
        """Test creating Observation with CodeableConcept value"""
        observation_data = {
            "text": "Smoking Status",
            "code": "72166-2",
            "display": "Tobacco smoking status",
            "status": "final",
            "effectiveDateTime": "2024-01-15T10:00:00Z",
            "valueCodeableConcept": {
                "code": "449868002",
                "display": "Current every day smoker",
                "system": "http://snomed.info/sct",
                "text": "Smoker"
            }
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.valueCodeableConcept is not None
        assert observation.valueCodeableConcept.coding[0].code == "449868002"
        assert observation.valueCodeableConcept.text == "Smoker"

    def test_create_observation_boolean_value(self):
        """Test creating Observation with boolean value"""
        observation_data = {
            "text": "Pregnancy Status",
            "code": "82810-3",
            "display": "Pregnancy status",
            "status": "final",
            "effectiveDateTime": "2024-01-15T10:00:00Z",
            "valueBoolean": True
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.valueBoolean is True
        assert observation.valueQuantity is None

    def test_create_observation_range_value(self):
        """Test creating Observation with range value"""
        observation_data = {
            "text": "Blood Pressure Range",
            "code": "85354-9",
            "display": "Blood pressure panel",
            "status": "final",
            "effectiveDateTime": "2024-01-15T10:00:00Z",
            "valueRange": {
                "low": 110,
                "high": 130,
                "unit": "mmHg"
            }
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.valueRange is not None
        assert observation.valueRange.low.value == 110
        assert observation.valueRange.high.value == 130
        assert observation.valueRange.low.unit == "mmHg"

    def test_create_observation_with_period(self):
        """Test creating Observation with effective period"""
        observation_data = {
            "text": "Pain Level",
            "observationName": "Pain Level",
            "status": "final",
            "effectivePeriod": {
                "start": "2024-01-15T08:00:00Z",
                "end": "2024-01-15T12:00:00Z"
            },
            "valueQuantity": {
                "value": 7,
                "unit": "score",
                "code": "{score}"
            }
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.effectivePeriod is not None
        assert str(observation.effectivePeriod.start) == "2024-01-15 08:00:00+00:00"
        assert str(observation.effectivePeriod.end) == "2024-01-15 12:00:00+00:00"
        assert observation.effectiveDateTime is None

    def test_create_observation_with_performer(self):
        """Test creating Observation with performer"""
        observation_data = {
            "text": "Heart Rate",
            "observationName": "Heart Rate",
            "status": "final",
            "effectiveDateTime": "2024-01-15T10:00:00Z",
            "valueQuantity": {
                "value": 72,
                "unit": "beats/minute",
                "code": "/min"
            },
            "performer": "Practitioner/doctor-456"
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.performer is not None
        assert len(observation.performer) == 1
        assert observation.performer[0].reference == "Practitioner/doctor-456"

    def test_create_observation_with_automatic_loinc_mapping(self):
        """Test creating Observation with automatic LOINC code mapping"""
        observation_data = {
            "observationName": "Hemoglobin",
            "status": "final",
            "effectiveDateTime": "2024-01-15T10:00:00Z",
            "valueQuantity": {
                "value": 14.5,
                "unit": "g/dL",
                "code": "g/dL"
            }
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.code.text == "Hemoglobin"
        # Check that LOINC code was automatically mapped
        assert observation.code.coding is not None
        assert len(observation.code.coding) > 0
        assert observation.code.coding[0].system == "http://loinc.org"
        assert observation.code.coding[0].code == "718-7"  # LOINC for hemoglobin

    def test_create_observation_minimal(self):
        """Test creating Observation with minimal data"""
        observation_data = {
            "text": "Clinical Note",
            "status": "final",
            "valueString": "Patient appears healthy"
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.status == "final"
        assert observation.code.text == "Clinical Note"
        assert observation.valueString == "Patient appears healthy"
        assert observation.subject.reference == "Patient/patient-123"


    def test_create_encounter(self):
        """Test creating Encounter resource"""
        encounter_data = {
            "status": "finished",
            "classCode": "AMB",
            "classDisplay": "ambulatory",
            "periodStart": "2024-01-15T09:00:00Z",
            "periodEnd": "2024-01-15T10:00:00Z"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        assert encounter.status == "finished"
        assert encounter.class_fhir[0].coding[0].code == "AMB"
        assert encounter.subject.reference == "Patient/patient-123"
        assert str(encounter.actualPeriod.start).startswith("2024-01-15")

    def test_create_encounter_with_type(self):
        """Test creating Encounter with type"""
        encounter_data = {
            "status": "finished",
            "classCode": "AMB",
            "classDisplay": "ambulatory",
            "type": [
                {
                    "code": "185349003",
                    "display": "Encounter for check up",
                    "system": "http://snomed.info/sct",
                    "text": "Check up"
                }
            ],
            "periodStart": "2024-01-15T09:00:00Z",
            "periodEnd": "2024-01-15T10:00:00Z"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        assert encounter.type is not None
        assert len(encounter.type) == 1
        assert encounter.type[0].coding[0].code == "185349003"
        assert encounter.type[0].text == "Check up"

    def test_create_encounter_with_reason(self):
        """Test creating Encounter with reason code"""
        encounter_data = {
            "status": "finished",
            "classCode": "AMB",
            "reasonCode": [
                {
                    "code": "386661006",
                    "display": "Fever",
                    "system": "http://snomed.info/sct",
                    "text": "Patient presenting with fever"
                }
            ],
            "periodStart": "2024-01-15T09:00:00Z"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        assert encounter.reason is not None
        assert len(encounter.reason) == 1
        assert encounter.reason[0].value[0].concept.coding[0].code == "386661006"
        assert encounter.reason[0].value[0].concept.text == "Patient presenting with fever"

    def test_create_encounter_with_participant(self):
        """Test creating Encounter with participant"""
        encounter_data = {
            "status": "finished",
            "classCode": "AMB",
            "participant": [
                {
                    "type": [
                        {
                            "code": "ATND",
                            "display": "attender",
                            "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType"
                        }
                    ],
                    "individual": "Practitioner/doctor-456",
                    "periodStart": "2024-01-15T09:00:00Z",
                    "periodEnd": "2024-01-15T10:00:00Z"
                }
            ],
            "periodStart": "2024-01-15T09:00:00Z"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        assert encounter.participant is not None
        assert len(encounter.participant) == 1
        assert encounter.participant[0].actor.reference == "Practitioner/doctor-456"
        assert encounter.participant[0].type[0].coding[0].code == "ATND"

    def test_create_encounter_with_diagnosis(self):
        """Test creating Encounter with diagnosis"""
        encounter_data = {
            "status": "finished",
            "classCode": "AMB",
            "diagnosis": [
                {
                    "condition": "Condition/condition-789",
                    "use": {
                        "code": "AD",
                        "display": "Admission diagnosis",
                        "system": "http://terminology.hl7.org/CodeSystem/diagnosis-role"
                    },
                    "rank": 1
                }
            ],
            "periodStart": "2024-01-15T09:00:00Z"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        assert encounter.diagnosis is not None
        assert len(encounter.diagnosis) == 1
        assert encounter.diagnosis[0].condition[0].reference.reference == "Condition/condition-789"
        assert encounter.diagnosis[0].use[0].coding[0].code == "AD"
        # rank field removed in FHIR R5

    def test_create_encounter_with_location(self):
        """Test creating Encounter with location"""
        encounter_data = {
            "status": "finished",
            "classCode": "AMB",
            "location": [
                {
                    "location": "Location/clinic-101",
                    "status": "active",
                    "periodStart": "2024-01-15T09:00:00Z",
                    "periodEnd": "2024-01-15T10:00:00Z"
                }
            ],
            "periodStart": "2024-01-15T09:00:00Z"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        assert encounter.location is not None
        assert len(encounter.location) == 1
        assert encounter.location[0].location.reference == "Location/clinic-101"
        assert encounter.location[0].status == "active"

    def test_create_encounter_with_service_provider(self):
        """Test creating Encounter with service provider"""
        encounter_data = {
            "status": "finished",
            "classCode": "AMB",
            "serviceProvider": "Organization/hospital-202",
            "periodStart": "2024-01-15T09:00:00Z"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        assert encounter.serviceProvider is not None
        assert encounter.serviceProvider.reference == "Organization/hospital-202"

    def test_create_encounter_with_hospitalization(self):
        """Test creating Encounter with hospitalization details"""
        encounter_data = {
            "status": "finished",
            "classCode": "IMP",
            "classDisplay": "inpatient encounter",
            "hospitalization": {
                "admitSource": {
                    "code": "emd",
                    "display": "From accident/emergency department",
                    "system": "http://terminology.hl7.org/CodeSystem/admit-source"
                },
                "dischargeDisposition": {
                    "code": "home",
                    "display": "Home",
                    "system": "http://terminology.hl7.org/CodeSystem/discharge-disposition"
                }
            },
            "periodStart": "2024-01-15T09:00:00Z",
            "periodEnd": "2024-01-17T14:00:00Z"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        assert encounter.admission is not None
        assert encounter.admission.admitSource.coding[0].code == "emd"
        assert encounter.admission.dischargeDisposition.coding[0].code == "home"

    def test_create_encounter_with_confidence(self):
        """Test creating Encounter with confidence score"""
        encounter_data = {
            "status": "finished",
            "classCode": "AMB",
            "periodStart": "2024-01-15T09:00:00Z",
            "confidence": 0.89,
            "extractionDate": "2024-01-15",
            "note": "Extracted from handwritten record"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        # Note: note field removed in FHIR R5

    def test_create_encounter_minimal(self):
        """Test creating Encounter with minimal data"""
        encounter_data = {
            "status": "finished"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        assert encounter.status == "finished"
        assert encounter.class_fhir[0].coding[0].code == "AMB"  # Default
        assert encounter.subject.reference == "Patient/patient-123"
    def test_create_encounter_with_type(self):
        """Test creating Encounter with type"""
        encounter_data = {
            "status": "finished",
            "classCode": "AMB",
            "classDisplay": "ambulatory",
            "type": [
                {
                    "code": "185349003",
                    "display": "Encounter for check up",
                    "system": "http://snomed.info/sct",
                    "text": "Check up"
                }
            ],
            "periodStart": "2024-01-15T09:00:00Z",
            "periodEnd": "2024-01-15T10:00:00Z"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        assert encounter.type is not None
        assert len(encounter.type) == 1
        assert encounter.type[0].coding[0].code == "185349003"
        assert encounter.type[0].text == "Check up"

    def test_create_encounter_with_reason(self):
        """Test creating Encounter with reason code"""
        encounter_data = {
            "status": "finished",
            "classCode": "AMB",
            "reasonCode": [
                {
                    "code": "386661006",
                    "display": "Fever",
                    "system": "http://snomed.info/sct",
                    "text": "Patient presenting with fever"
                }
            ],
            "periodStart": "2024-01-15T09:00:00Z"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        assert encounter.reason is not None
        assert len(encounter.reason) == 1
        assert encounter.reason[0].value[0].concept.coding[0].code == "386661006"
        assert encounter.reason[0].value[0].concept.text == "Patient presenting with fever"

    def test_create_encounter_with_participant(self):
        """Test creating Encounter with participant"""
        encounter_data = {
            "status": "finished",
            "classCode": "AMB",
            "participant": [
                {
                    "type": [
                        {
                            "code": "ATND",
                            "display": "attender",
                            "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType"
                        }
                    ],
                    "individual": "Practitioner/doctor-456",
                    "periodStart": "2024-01-15T09:00:00Z",
                    "periodEnd": "2024-01-15T10:00:00Z"
                }
            ],
            "periodStart": "2024-01-15T09:00:00Z"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        assert encounter.participant is not None
        assert len(encounter.participant) == 1
        assert encounter.participant[0].actor.reference == "Practitioner/doctor-456"
        assert encounter.participant[0].type[0].coding[0].code == "ATND"

    def test_create_encounter_with_diagnosis(self):
        """Test creating Encounter with diagnosis"""
        encounter_data = {
            "status": "finished",
            "classCode": "AMB",
            "diagnosis": [
                {
                    "condition": "Condition/condition-789",
                    "use": {
                        "code": "AD",
                        "display": "Admission diagnosis",
                        "system": "http://terminology.hl7.org/CodeSystem/diagnosis-role"
                    },
                    "rank": 1
                }
            ],
            "periodStart": "2024-01-15T09:00:00Z"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        assert encounter.diagnosis is not None
        assert len(encounter.diagnosis) == 1
        assert encounter.diagnosis[0].condition[0].reference.reference == "Condition/condition-789"
        assert encounter.diagnosis[0].use[0].coding[0].code == "AD"
        # rank field removed in FHIR R5

    def test_create_encounter_with_location(self):
        """Test creating Encounter with location"""
        encounter_data = {
            "status": "finished",
            "classCode": "AMB",
            "location": [
                {
                    "location": "Location/clinic-101",
                    "status": "active",
                    "periodStart": "2024-01-15T09:00:00Z",
                    "periodEnd": "2024-01-15T10:00:00Z"
                }
            ],
            "periodStart": "2024-01-15T09:00:00Z"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        assert encounter.location is not None
        assert len(encounter.location) == 1
        assert encounter.location[0].location.reference == "Location/clinic-101"
        assert encounter.location[0].status == "active"

    def test_create_encounter_with_service_provider(self):
        """Test creating Encounter with service provider"""
        encounter_data = {
            "status": "finished",
            "classCode": "AMB",
            "serviceProvider": "Organization/hospital-202",
            "periodStart": "2024-01-15T09:00:00Z"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        assert encounter.serviceProvider is not None
        assert encounter.serviceProvider.reference == "Organization/hospital-202"

    def test_create_encounter_with_hospitalization(self):
        """Test creating Encounter with hospitalization details"""
        encounter_data = {
            "status": "finished",
            "classCode": "IMP",
            "classDisplay": "inpatient encounter",
            "hospitalization": {
                "admitSource": {
                    "code": "emd",
                    "display": "From accident/emergency department",
                    "system": "http://terminology.hl7.org/CodeSystem/admit-source"
                },
                "dischargeDisposition": {
                    "code": "home",
                    "display": "Home",
                    "system": "http://terminology.hl7.org/CodeSystem/discharge-disposition"
                }
            },
            "periodStart": "2024-01-15T09:00:00Z",
            "periodEnd": "2024-01-17T14:00:00Z"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        assert encounter.admission is not None
        assert encounter.admission.admitSource.coding[0].code == "emd"
        assert encounter.admission.dischargeDisposition.coding[0].code == "home"

    def test_create_encounter_with_confidence(self):
        """Test creating Encounter with confidence score"""
        encounter_data = {
            "status": "finished",
            "classCode": "AMB",
            "periodStart": "2024-01-15T09:00:00Z",
            "confidence": 0.89,
            "extractionDate": "2024-01-15",
            "note": "Extracted from handwritten record"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        # Note: note field removed in FHIR R5

    def test_create_encounter_minimal(self):
        """Test creating Encounter with minimal data"""
        encounter_data = {
            "status": "finished"
        }

        encounter = self.builder.create_encounter(
            encounter_data,
            "Patient/patient-123"
        )

        assert encounter.get_resource_type() == "Encounter"
        assert encounter.status == "finished"
        assert encounter.class_fhir[0].coding[0].code == "AMB"  # Default
        assert encounter.subject.reference == "Patient/patient-123"


    def test_create_diagnostic_report(self):
        """Test creating DiagnosticReport resource"""
        report_data = {
            "text": "Complete Blood Count",
            "code": "58410-2",
            "display": "Complete blood count (hemogram) panel",
            "codeSystem": "http://loinc.org",
            "status": "final",
            "effectiveDateTime": "2024-01-15T10:30:00Z",
            "conclusion": "All values within normal range"
        }

        diagnostic_report = self.builder.create_diagnostic_report(
            report_data,
            "Patient/patient-123"
        )

        assert diagnostic_report.get_resource_type() == "DiagnosticReport"
        assert diagnostic_report.status == "final"
        assert diagnostic_report.code.text == "Complete Blood Count"
        assert diagnostic_report.subject.reference == "Patient/patient-123"
        assert diagnostic_report.conclusion == "All values within normal range"

    def test_create_diagnostic_report_with_category(self):
        """Test creating DiagnosticReport with category"""
        report_data = {
            "text": "Chest X-Ray",
            "code": "30746-2",
            "display": "Chest X-ray",
            "status": "final",
            "category": "RAD",
            "categoryDisplay": "Radiology",
            "effectiveDateTime": "2024-01-15T14:00:00Z",
            "conclusion": "No acute findings"
        }

        diagnostic_report = self.builder.create_diagnostic_report(
            report_data,
            "Patient/patient-123"
        )

        assert diagnostic_report.get_resource_type() == "DiagnosticReport"
        assert diagnostic_report.category is not None
        assert len(diagnostic_report.category) == 1
        assert diagnostic_report.category[0].coding[0].code == "RAD"
        assert diagnostic_report.category[0].coding[0].display == "Radiology"

    def test_create_diagnostic_report_with_results(self):
        """Test creating DiagnosticReport with result references"""
        report_data = {
            "text": "Lipid Panel",
            "code": "24331-1",
            "display": "Lipid panel",
            "status": "final",
            "category": "LAB",
            "categoryDisplay": "Laboratory",
            "effectiveDateTime": "2024-01-15T09:00:00Z",
            "result": [
                "Observation/obs-cholesterol-123",
                "Observation/obs-hdl-124",
                "Observation/obs-ldl-125",
                "Observation/obs-triglycerides-126"
            ],
            "conclusion": "Cholesterol levels elevated. Recommend dietary modifications."
        }

        diagnostic_report = self.builder.create_diagnostic_report(
            report_data,
            "Patient/patient-123"
        )

        assert diagnostic_report.get_resource_type() == "DiagnosticReport"
        assert diagnostic_report.result is not None
        assert len(diagnostic_report.result) == 4
        assert diagnostic_report.result[0].reference == "Observation/obs-cholesterol-123"
        assert diagnostic_report.conclusion == "Cholesterol levels elevated. Recommend dietary modifications."

    def test_create_diagnostic_report_with_performer(self):
        """Test creating DiagnosticReport with performer"""
        report_data = {
            "text": "Blood Glucose Test",
            "code": "2339-0",
            "display": "Glucose [Mass/volume] in Blood",
            "status": "final",
            "category": "LAB",
            "effectiveDateTime": "2024-01-15T08:30:00Z",
            "performer": [
                {
                    "reference": "Practitioner/lab-tech-456",
                    "display": "Dr. Priya Sharma"
                }
            ],
            "resultsInterpreter": [
                {
                    "reference": "Practitioner/pathologist-789",
                    "display": "Dr. Rajesh Kumar"
                }
            ]
        }

        diagnostic_report = self.builder.create_diagnostic_report(
            report_data,
            "Patient/patient-123"
        )

        assert diagnostic_report.get_resource_type() == "DiagnosticReport"
        assert diagnostic_report.performer is not None
        assert len(diagnostic_report.performer) == 1
        assert diagnostic_report.performer[0].reference == "Practitioner/lab-tech-456"
        assert diagnostic_report.performer[0].display == "Dr. Priya Sharma"
        assert diagnostic_report.resultsInterpreter is not None
        assert diagnostic_report.resultsInterpreter[0].reference == "Practitioner/pathologist-789"

    def test_create_diagnostic_report_with_confidence(self):
        """Test creating DiagnosticReport with confidence score"""
        report_data = {
            "text": "Urinalysis",
            "code": "24356-8",
            "display": "Urinalysis complete panel",
            "status": "final",
            "effectiveDateTime": "2024-01-15T11:00:00Z",
            "conclusion": "Normal findings",
            "confidence": 0.95,
            "extractionDate": "2024-01-15"
        }

        diagnostic_report = self.builder.create_diagnostic_report(
            report_data,
            "Patient/patient-123"
        )

        assert diagnostic_report.get_resource_type() == "DiagnosticReport"
        assert diagnostic_report.note is not None
        assert len(diagnostic_report.note) == 1
        assert "Confidence: 95%" in diagnostic_report.note[0].text
        assert "Extracted from document dated 2024-01-15" in diagnostic_report.note[0].text

    def test_create_diagnostic_report_with_period(self):
        """Test creating DiagnosticReport with effective period"""
        report_data = {
            "text": "24-Hour Urine Collection",
            "code": "3167-4",
            "display": "Volume of 24 hour Urine",
            "status": "final",
            "effectiveStart": "2024-01-14T08:00:00Z",
            "effectiveEnd": "2024-01-15T08:00:00Z",
            "conclusion": "Total volume within normal range"
        }

        diagnostic_report = self.builder.create_diagnostic_report(
            report_data,
            "Patient/patient-123"
        )

        assert diagnostic_report.get_resource_type() == "DiagnosticReport"
        assert diagnostic_report.effectivePeriod is not None
        assert str(diagnostic_report.effectivePeriod.start).startswith("2024-01-14")
        assert str(diagnostic_report.effectivePeriod.end).startswith("2024-01-15")
        assert diagnostic_report.effectiveDateTime is None

    def test_create_diagnostic_report_with_presented_form(self):
        """Test creating DiagnosticReport with attached document"""
        report_data = {
            "text": "ECG Report",
            "code": "11524-6",
            "display": "EKG study",
            "status": "final",
            "category": "CG",
            "categoryDisplay": "Cardiology",
            "effectiveDateTime": "2024-01-15T10:00:00Z",
            "conclusion": "Normal sinus rhythm",
            "presentedForm": [
                {
                    "contentType": "application/pdf",
                    "url": "https://s3.amazonaws.com/vaidyalink/reports/ecg-123.pdf",
                    "title": "ECG Report PDF"
                }
            ]
        }

        diagnostic_report = self.builder.create_diagnostic_report(
            report_data,
            "Patient/patient-123"
        )

        assert diagnostic_report.get_resource_type() == "DiagnosticReport"
        assert diagnostic_report.presentedForm is not None
        assert len(diagnostic_report.presentedForm) == 1
        assert diagnostic_report.presentedForm[0].contentType == "application/pdf"
        assert "ecg-123.pdf" in diagnostic_report.presentedForm[0].url
        assert diagnostic_report.presentedForm[0].title == "ECG Report PDF"

    def test_create_diagnostic_report_minimal(self):
        """Test creating DiagnosticReport with minimal data"""
        report_data = {
            "text": "Basic Lab Test",
            "status": "final"
        }

        diagnostic_report = self.builder.create_diagnostic_report(
            report_data,
            "Patient/patient-123"
        )

        assert diagnostic_report.get_resource_type() == "DiagnosticReport"
        assert diagnostic_report.status == "final"
        assert diagnostic_report.code.text == "Basic Lab Test"
        assert diagnostic_report.subject.reference == "Patient/patient-123"
        assert diagnostic_report.conclusion is None



    def test_create_bundle(self):
        """Test creating FHIR Bundle"""
        patient_data = {
            "patientId": "patient-123",
            "name": "Test Patient",
            "gender": "male",
            "birthDate": "1990-01-01"
        }
        patient = self.builder.create_patient(patient_data)

        medication_data = {
            "text": "Aspirin 100mg",
            "status": "active"
        }
        med_statement = self.builder.create_medication_statement(
            medication_data,
            "Patient/patient-123"
        )

        bundle = self.builder.create_bundle([patient, med_statement])

        assert bundle.get_resource_type() == "Bundle"
        assert bundle.type == "collection"
        assert len(bundle.entry) == 2

    def test_resource_to_dict(self):
        """Test converting resource to dictionary"""
        patient_data = {
            "patientId": "patient-123",
            "name": "Test Patient",
            "gender": "male",
            "birthDate": "1990-01-01"
        }
        patient = self.builder.create_patient(patient_data)

        patient_dict = self.builder.resource_to_dict(patient)

        assert isinstance(patient_dict, dict)
        assert patient_dict['resourceType'] == 'Patient'
        assert patient_dict['gender'] == 'male'

    def test_resource_to_json(self):
        """Test converting resource to JSON"""
        patient_data = {
            "patientId": "patient-123",
            "name": "Test Patient",
            "gender": "male",
            "birthDate": "1990-01-01"
        }
        patient = self.builder.create_patient(patient_data)

        patient_json = self.builder.resource_to_json(patient)

        assert isinstance(patient_json, str)
        assert '"resourceType":"Patient"' in patient_json or '"resourceType": "Patient"' in patient_json
        assert '"gender":"male"' in patient_json or '"gender": "male"' in patient_json

    def test_create_observation_vital_signs(self):
        """Test creating Observation for vital signs"""
        observation_data = {
            "observationName": "Blood Pressure",
            "category": "vital-signs",
            "categoryDisplay": "Vital Signs",
            "status": "final",
            "effectiveDateTime": "2024-01-15T10:30:00Z",
            "valueQuantity": {
                "value": 120,
                "unit": "mmHg",
                "code": "mm[Hg]"
            },
            "referenceRange": {
                "low": 90,
                "high": 140,
                "unit": "mmHg",
                "text": "Normal range"
            },
            "interpretation": "N",
            "interpretationDisplay": "Normal",
            "confidence": 0.95
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.status == "final"
        assert observation.category is not None
        assert len(observation.category) == 1
        assert observation.category[0].coding[0].code == "vital-signs"
        assert observation.code.text == "Blood Pressure"
        assert observation.code.coding[0].code == "85354-9"  # LOINC code
        assert observation.valueQuantity.value == 120
        assert observation.valueQuantity.unit == "mmHg"
        assert observation.referenceRange is not None
        assert len(observation.referenceRange) == 1
        assert observation.referenceRange[0].low.value == 90
        assert observation.referenceRange[0].high.value == 140
        assert observation.interpretation is not None
        assert observation.interpretation[0].coding[0].code == "N"
        assert "Confidence: 95%" in observation.note[0].text

    def test_create_observation_lab_result(self):
        """Test creating Observation for lab result"""
        observation_data = {
            "observationName": "Blood Glucose",
            "category": "laboratory",
            "status": "final",
            "effectiveDateTime": "2024-01-15T08:00:00Z",
            "valueQuantity": {
                "value": 95,
                "unit": "mg/dL",
                "code": "mg/dL"
            },
            "referenceRange": {
                "low": 70,
                "high": 100,
                "unit": "mg/dL",
                "text": "Fasting glucose normal range"
            },
            "interpretation": "N",
            "note": "Fasting blood glucose test",
            "confidence": 0.92,
            "extractionDate": "2024-01-15"
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.code.coding[0].code == "2339-0"  # LOINC for blood glucose
        assert observation.valueQuantity.value == 95
        assert "Confidence: 92%" in observation.note[0].text
        assert "Extraction date: 2024-01-15" in observation.note[0].text

    def test_create_observation_string_value(self):
        """Test creating Observation with string value"""
        observation_data = {
            "text": "Blood Type",
            "code": "883-9",
            "display": "ABO group [Type] in Blood",
            "status": "final",
            "effectiveDateTime": "2024-01-15T10:00:00Z",
            "valueString": "A+"
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.valueString == "A+"
        assert observation.valueQuantity is None

    def test_create_observation_codeable_concept_value(self):
        """Test creating Observation with CodeableConcept value"""
        observation_data = {
            "text": "Smoking Status",
            "code": "72166-2",
            "display": "Tobacco smoking status",
            "status": "final",
            "effectiveDateTime": "2024-01-15T10:00:00Z",
            "valueCodeableConcept": {
                "code": "449868002",
                "display": "Current every day smoker",
                "system": "http://snomed.info/sct",
                "text": "Smoker"
            }
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.valueCodeableConcept is not None
        assert observation.valueCodeableConcept.coding[0].code == "449868002"
        assert observation.valueCodeableConcept.text == "Smoker"

    def test_create_observation_boolean_value(self):
        """Test creating Observation with boolean value"""
        observation_data = {
            "text": "Pregnancy Status",
            "code": "82810-3",
            "display": "Pregnancy status",
            "status": "final",
            "effectiveDateTime": "2024-01-15T10:00:00Z",
            "valueBoolean": True
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.valueBoolean is True
        assert observation.valueQuantity is None

    def test_create_observation_range_value(self):
        """Test creating Observation with range value"""
        observation_data = {
            "text": "Blood Pressure Range",
            "code": "85354-9",
            "display": "Blood pressure panel",
            "status": "final",
            "effectiveDateTime": "2024-01-15T10:00:00Z",
            "valueRange": {
                "low": 110,
                "high": 130,
                "unit": "mmHg"
            }
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.valueRange is not None
        assert observation.valueRange.low.value == 110
        assert observation.valueRange.high.value == 130
        assert observation.valueRange.low.unit == "mmHg"

    def test_create_observation_with_period(self):
        """Test creating Observation with effective period"""
        observation_data = {
            "text": "Pain Level",
            "observationName": "Pain Level",
            "status": "final",
            "effectivePeriod": {
                "start": "2024-01-15T08:00:00Z",
                "end": "2024-01-15T12:00:00Z"
            },
            "valueQuantity": {
                "value": 7,
                "unit": "score",
                "code": "{score}"
            }
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.effectivePeriod is not None
        assert str(observation.effectivePeriod.start) == "2024-01-15 08:00:00+00:00"
        assert str(observation.effectivePeriod.end) == "2024-01-15 12:00:00+00:00"
        assert observation.effectiveDateTime is None

    def test_create_observation_with_performer(self):
        """Test creating Observation with performer"""
        observation_data = {
            "text": "Heart Rate",
            "observationName": "Heart Rate",
            "status": "final",
            "effectiveDateTime": "2024-01-15T10:00:00Z",
            "valueQuantity": {
                "value": 72,
                "unit": "beats/minute",
                "code": "/min"
            },
            "performer": "Practitioner/doctor-456"
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.performer is not None
        assert len(observation.performer) == 1
        assert observation.performer[0].reference == "Practitioner/doctor-456"

    def test_create_observation_with_automatic_loinc_mapping(self):
        """Test creating Observation with automatic LOINC code mapping"""
        observation_data = {
            "observationName": "Hemoglobin",
            "status": "final",
            "effectiveDateTime": "2024-01-15T10:00:00Z",
            "valueQuantity": {
                "value": 14.5,
                "unit": "g/dL",
                "code": "g/dL"
            }
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.code.text == "Hemoglobin"
        # Check that LOINC code was automatically mapped
        assert observation.code.coding is not None
        assert len(observation.code.coding) > 0
        assert observation.code.coding[0].system == "http://loinc.org"
        assert observation.code.coding[0].code == "718-7"  # LOINC for hemoglobin

    def test_create_observation_minimal(self):
        """Test creating Observation with minimal data"""
        observation_data = {
            "text": "Clinical Note",
            "status": "final",
            "valueString": "Patient appears healthy"
        }

        observation = self.builder.create_observation(
            observation_data,
            "Patient/patient-123"
        )

        assert observation.get_resource_type() == "Observation"
        assert observation.status == "final"
        assert observation.code.text == "Clinical Note"
        assert observation.valueString == "Patient appears healthy"
        assert observation.subject.reference == "Patient/patient-123"

