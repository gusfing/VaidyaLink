"""
Unit tests for data aggregation pipeline
"""

import pytest
from datetime import datetime, timedelta
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from utils.data_aggregator import (
    aggregate_clinical_data,
    extract_patient_demographics,
    extract_conditions,
    extract_medications,
    extract_encounters,
    extract_observations,
    extract_allergies,
    extract_diagnostic_reports,
    extract_procedures,
    identify_critical_information,
    create_chronological_timeline,
    DataAggregationError
)


class TestAggregateClinicalData:
    """Tests for main aggregation function"""

    def test_aggregate_empty_resources(self):
        """Test aggregation with empty resource list"""
        resources = []
        options = {}

        result = aggregate_clinical_data(resources, options)

        assert result['patient'] == {}
        assert result['conditions'] == []
        assert result['medications'] == []
        assert result['encounters'] == []
        assert result['metadata']['totalResources'] == 0

    def test_aggregate_with_patient_only(self):
        """Test aggregation with only patient resource"""
        resources = [
            {
                'resourceType': 'Patient',
                'id': 'patient-123',
                'name': [{'text': 'John Doe'}],
                'gender': 'male',
                'birthDate': '1985-06-15'
            }
        ]
        options = {}

        result = aggregate_clinical_data(resources, options)

        assert result['patient']['id'] == 'patient-123'
        assert result['patient']['name'] == 'John Doe'
        assert result['patient']['gender'] == 'male'
        assert result['patient']['age'] is not None


    def test_aggregate_full_resources(self):
        """Test aggregation with multiple resource types"""
        resources = [
            {
                'resourceType': 'Patient',
                'id': 'patient-123',
                'name': [{'text': 'John Doe'}],
                'gender': 'male',
                'birthDate': '1985-06-15'
            },
            {
                'resourceType': 'Condition',
                'id': 'condition-1',
                'code': {
                    'coding': [{'code': 'E11', 'display': 'Type 2 Diabetes Mellitus', 'system': 'ICD-10'}]
                },
                'clinicalStatus': {'coding': [{'code': 'active', 'display': 'active'}]},
                'onsetDateTime': '2020-01-15'
            },
            {
                'resourceType': 'MedicationStatement',
                'id': 'med-1',
                'medicationCodeableConcept': {
                    'coding': [{'code': 'A10BA02', 'display': 'Metformin', 'system': 'ATC'}]
                },
                'status': 'active',
                'effectiveDateTime': '2020-01-20'
            },
            {
                'resourceType': 'AllergyIntolerance',
                'id': 'allergy-1',
                'code': {
                    'coding': [{'code': '387207008', 'display': 'Penicillin', 'system': 'SNOMED'}]
                },
                'clinicalStatus': {'coding': [{'code': 'active', 'display': 'active'}]},
                'criticality': 'high'
            }
        ]
        options = {'includeLabResults': True, 'includeVitalSigns': True}

        result = aggregate_clinical_data(resources, options)

        assert result['patient']['id'] == 'patient-123'
        assert len(result['conditions']) == 1
        assert len(result['medications']) == 1
        assert len(result['allergies']) == 1
        assert result['metadata']['totalResources'] == 4
        assert 'criticalInformation' in result
        assert 'timeline' in result

    def test_aggregate_with_options(self):
        """Test aggregation respects options"""
        resources = [
            {
                'resourceType': 'Observation',
                'id': 'obs-1',
                'code': {'coding': [{'code': '2339-0', 'display': 'Glucose', 'system': 'LOINC'}]},
                'category': [{'coding': [{'code': 'laboratory', 'display': 'Laboratory'}]}],
                'effectiveDateTime': '2024-01-15',
                'valueQuantity': {'value': 120, 'unit': 'mg/dL'}
            }
        ]
        options = {'includeLabResults': False}

        result = aggregate_clinical_data(resources, options)

        # Lab results should be filtered out
        assert len(result['observations']) == 0


class TestExtractPatientDemographics:
    """Tests for patient demographics extraction"""

    def test_extract_patient_basic(self):
        """Test basic patient extraction"""
        patients = [
            {
                'id': 'patient-123',
                'name': [{'text': 'Jane Smith'}],
                'gender': 'female',
                'birthDate': '1990-03-20'
            }
        ]

        result = extract_patient_demographics(patients)

        assert result['id'] == 'patient-123'
        assert result['name'] == 'Jane Smith'
        assert result['gender'] == 'female'
        assert result['birthDate'] == '1990-03-20'
        assert result['age'] is not None

    def test_extract_patient_with_structured_name(self):
        """Test patient extraction with structured name"""
        patients = [
            {
                'id': 'patient-123',
                'name': [
                    {
                        'use': 'official',
                        'given': ['Jane', 'Marie'],
                        'family': 'Smith'
                    }
                ],
                'gender': 'female',
                'birthDate': '1990-03-20'
            }
        ]

        result = extract_patient_demographics(patients)

        assert 'Jane' in result['name']
        assert 'Smith' in result['name']

    def test_extract_patient_with_contact(self):
        """Test patient extraction with contact information"""
        patients = [
            {
                'id': 'patient-123',
                'name': [{'text': 'John Doe'}],
                'telecom': [
                    {'system': 'phone', 'value': '+91-9876543210'},
                    {'system': 'email', 'value': 'john@example.com'}
                ],
                'address': [
                    {
                        'use': 'home',
                        'line': ['123 Main St'],
                        'city': 'Mumbai',
                        'state': 'Maharashtra',
                        'country': 'IN'
                    }
                ]
            }
        ]

        result = extract_patient_demographics(patients)

        assert result['phone'] == '+91-9876543210'
        assert result['email'] == 'john@example.com'
        assert 'Mumbai' in result['address']

    def test_extract_patient_with_abha_id(self):
        """Test patient extraction with ABHA ID"""
        patients = [
            {
                'id': 'patient-123',
                'name': [{'text': 'John Doe'}],
                'identifier': [
                    {
                        'system': 'https://abdm.gov.in/abha',
                        'value': '12-3456-7890-1234'
                    }
                ]
            }
        ]

        result = extract_patient_demographics(patients)

        assert result['identifiers']['abhaId'] == '12-3456-7890-1234'

    def test_extract_patient_empty(self):
        """Test patient extraction with empty list"""
        result = extract_patient_demographics([])

        assert result == {}



class TestExtractConditions:
    """Tests for condition extraction"""

    def test_extract_conditions_basic(self):
        """Test basic condition extraction"""
        conditions = [
            {
                'id': 'condition-1',
                'code': {
                    'coding': [{'code': 'E11', 'display': 'Type 2 Diabetes Mellitus', 'system': 'ICD-10'}]
                },
                'clinicalStatus': {'coding': [{'code': 'active', 'display': 'active'}]},
                'verificationStatus': {'coding': [{'code': 'confirmed', 'display': 'confirmed'}]},
                'onsetDateTime': '2020-01-15',
                'recordedDate': '2020-01-15'
            }
        ]

        result = extract_conditions(conditions)

        assert len(result) == 1
        assert result[0]['id'] == 'condition-1'
        assert result[0]['display'] == 'Type 2 Diabetes Mellitus'
        assert result[0]['clinicalStatus'] == 'active'
        assert result[0]['onsetDate'] == '2020-01-15'
        assert result[0]['isChronic'] is True

    def test_extract_conditions_chronic_detection(self):
        """Test chronic condition detection"""
        conditions = [
            {
                'id': 'condition-1',
                'code': {'coding': [{'display': 'Chronic Kidney Disease'}]},
                'clinicalStatus': {'coding': [{'display': 'active'}]}
            },
            {
                'id': 'condition-2',
                'code': {'coding': [{'display': 'Common Cold'}]},
                'clinicalStatus': {'coding': [{'display': 'resolved'}]}
            }
        ]

        result = extract_conditions(conditions)

        chronic_condition = next(c for c in result if c['id'] == 'condition-1')
        acute_condition = next(c for c in result if c['id'] == 'condition-2')

        assert chronic_condition['isChronic'] is True
        assert acute_condition['isChronic'] is False

    def test_extract_conditions_sorting(self):
        """Test conditions are sorted by date"""
        conditions = [
            {
                'id': 'condition-1',
                'code': {'coding': [{'display': 'Condition 1'}]},
                'onsetDateTime': '2020-01-15'
            },
            {
                'id': 'condition-2',
                'code': {'coding': [{'display': 'Condition 2'}]},
                'onsetDateTime': '2023-06-20'
            },
            {
                'id': 'condition-3',
                'code': {'coding': [{'display': 'Condition 3'}]},
                'onsetDateTime': '2021-03-10'
            }
        ]

        result = extract_conditions(conditions)

        # Should be sorted most recent first
        assert result[0]['id'] == 'condition-2'
        assert result[1]['id'] == 'condition-3'
        assert result[2]['id'] == 'condition-1'


class TestExtractMedications:
    """Tests for medication extraction"""

    def test_extract_medications_basic(self):
        """Test basic medication extraction"""
        medications = [
            {
                'id': 'med-1',
                'medicationCodeableConcept': {
                    'coding': [{'code': 'A10BA02', 'display': 'Metformin 500mg', 'system': 'ATC'}]
                },
                'status': 'active',
                'effectiveDateTime': '2020-01-20',
                'dosage': [
                    {
                        'text': 'One tablet twice daily',
                        'doseAndRate': [
                            {'doseQuantity': {'value': 500, 'unit': 'mg'}}
                        ]
                    }
                ]
            }
        ]

        result = extract_medications(medications)

        assert len(result) == 1
        assert result[0]['id'] == 'med-1'
        assert result[0]['display'] == 'Metformin 500mg'
        assert result[0]['status'] == 'active'
        assert result[0]['isActive'] is True
        assert result[0]['dosage'] is not None

    def test_extract_medications_active_detection(self):
        """Test active medication detection"""
        future_date = (datetime.utcnow() + timedelta(days=30)).isoformat()
        past_date = (datetime.utcnow() - timedelta(days=30)).isoformat()

        medications = [
            {
                'id': 'med-1',
                'medicationCodeableConcept': {'coding': [{'display': 'Active Med'}]},
                'status': 'active',
                'effectivePeriod': {'start': '2020-01-01', 'end': future_date}
            },
            {
                'id': 'med-2',
                'medicationCodeableConcept': {'coding': [{'display': 'Stopped Med'}]},
                'status': 'stopped'
            },
            {
                'id': 'med-3',
                'medicationCodeableConcept': {'coding': [{'display': 'Completed Med'}]},
                'status': 'completed',
                'effectivePeriod': {'start': '2019-01-01', 'end': past_date}
            }
        ]

        result = extract_medications(medications)

        active_med = next(m for m in result if m['id'] == 'med-1')
        stopped_med = next(m for m in result if m['id'] == 'med-2')
        completed_med = next(m for m in result if m['id'] == 'med-3')

        assert active_med['isActive'] is True
        assert stopped_med['isActive'] is False
        assert completed_med['isActive'] is False


class TestExtractEncounters:
    """Tests for encounter extraction"""

    def test_extract_encounters_basic(self):
        """Test basic encounter extraction"""
        encounters = [
            {
                'id': 'enc-1',
                'class': {'code': 'AMB', 'display': 'Ambulatory'},
                'status': 'finished',
                'period': {'start': '2024-01-15T10:00:00Z', 'end': '2024-01-15T11:00:00Z'},
                'type': [
                    {'coding': [{'code': 'checkup', 'display': 'Routine Checkup'}]}
                ],
                'reasonCode': [
                    {'coding': [{'display': 'Annual Physical'}]}
                ]
            }
        ]

        result = extract_encounters(encounters)

        assert len(result) == 1
        assert result[0]['id'] == 'enc-1'
        assert result[0]['class'] == 'AMB'
        assert result[0]['classDisplay'] == 'Ambulatory'
        assert result[0]['status'] == 'finished'
        assert result[0]['reason'] == 'Annual Physical'


class TestExtractObservations:
    """Tests for observation extraction"""

    def test_extract_observations_lab_results(self):
        """Test lab result extraction"""
        observations = [
            {
                'id': 'obs-1',
                'code': {'coding': [{'code': '2339-0', 'display': 'Glucose', 'system': 'LOINC'}]},
                'category': [{'coding': [{'code': 'laboratory', 'display': 'Laboratory'}]}],
                'status': 'final',
                'effectiveDateTime': '2024-01-15',
                'valueQuantity': {'value': 120, 'unit': 'mg/dL'},
                'interpretation': [{'coding': [{'code': 'H', 'display': 'High'}]}]
            }
        ]

        result = extract_observations(observations, include_lab_results=True, include_vital_signs=True)

        assert len(result) == 1
        assert result[0]['display'] == 'Glucose'
        assert result[0]['isLabResult'] is True
        assert result[0]['value'] == 120
        assert result[0]['unit'] == 'mg/dL'

    def test_extract_observations_vital_signs(self):
        """Test vital signs extraction"""
        observations = [
            {
                'id': 'obs-1',
                'code': {'coding': [{'code': '8867-4', 'display': 'Heart rate', 'system': 'LOINC'}]},
                'category': [{'coding': [{'code': 'vital-signs', 'display': 'Vital Signs'}]}],
                'status': 'final',
                'effectiveDateTime': '2024-01-15',
                'valueQuantity': {'value': 72, 'unit': 'beats/min'}
            }
        ]

        result = extract_observations(observations, include_lab_results=True, include_vital_signs=True)

        assert len(result) == 1
        assert result[0]['isVitalSign'] is True
        assert result[0]['value'] == 72

    def test_extract_observations_filtering(self):
        """Test observation filtering by options"""
        observations = [
            {
                'id': 'obs-1',
                'code': {'coding': [{'display': 'Lab Test'}]},
                'category': [{'coding': [{'code': 'laboratory'}]}],
                'effectiveDateTime': '2024-01-15',
                'valueQuantity': {'value': 100}
            },
            {
                'id': 'obs-2',
                'code': {'coding': [{'display': 'Blood Pressure'}]},
                'category': [{'coding': [{'code': 'vital-signs'}]}],
                'effectiveDateTime': '2024-01-15',
                'valueQuantity': {'value': 120}
            }
        ]

        # Include only lab results
        result = extract_observations(observations, include_lab_results=True, include_vital_signs=False)
        assert len(result) == 1
        assert result[0]['id'] == 'obs-1'

        # Include only vital signs
        result = extract_observations(observations, include_lab_results=False, include_vital_signs=True)
        assert len(result) == 1
        assert result[0]['id'] == 'obs-2'



class TestExtractAllergies:
    """Tests for allergy extraction"""

    def test_extract_allergies_basic(self):
        """Test basic allergy extraction"""
        allergies = [
            {
                'id': 'allergy-1',
                'code': {'coding': [{'code': '387207008', 'display': 'Penicillin', 'system': 'SNOMED'}]},
                'clinicalStatus': {'coding': [{'code': 'active', 'display': 'active'}]},
                'verificationStatus': {'coding': [{'code': 'confirmed', 'display': 'confirmed'}]},
                'type': 'allergy',
                'category': ['medication'],
                'criticality': 'high',
                'recordedDate': '2020-01-15',
                'reaction': [
                    {
                        'manifestation': [
                            {'coding': [{'display': 'Rash'}]},
                            {'coding': [{'display': 'Itching'}]}
                        ],
                        'severity': 'moderate'
                    }
                ]
            }
        ]

        result = extract_allergies(allergies)

        assert len(result) == 1
        assert result[0]['display'] == 'Penicillin'
        assert result[0]['criticality'] == 'high'
        assert result[0]['type'] == 'allergy'
        assert 'medication' in result[0]['categories']
        assert len(result[0]['reactions']) == 1

    def test_extract_allergies_sorting(self):
        """Test allergies are sorted by criticality"""
        allergies = [
            {
                'id': 'allergy-1',
                'code': {'coding': [{'display': 'Peanuts'}]},
                'criticality': 'low',
                'recordedDate': '2023-01-15'
            },
            {
                'id': 'allergy-2',
                'code': {'coding': [{'display': 'Shellfish'}]},
                'criticality': 'high',
                'recordedDate': '2020-01-15'
            },
            {
                'id': 'allergy-3',
                'code': {'coding': [{'display': 'Latex'}]},
                'criticality': 'high',
                'recordedDate': '2022-01-15'
            }
        ]

        result = extract_allergies(allergies)

        # High criticality should come first
        assert result[0]['criticality'] == 'high'
        assert result[1]['criticality'] == 'high'
        assert result[2]['criticality'] == 'low'


class TestIdentifyCriticalInformation:
    """Tests for critical information identification"""

    def test_identify_chronic_conditions(self):
        """Test chronic condition identification"""
        conditions = [
            {
                'id': 'cond-1',
                'display': 'Type 2 Diabetes',
                'isChronic': True,
                'clinicalStatus': 'active',
                'onsetDate': '2020-01-15'
            },
            {
                'id': 'cond-2',
                'display': 'Common Cold',
                'isChronic': False,
                'clinicalStatus': 'resolved'
            }
        ]

        result = identify_critical_information(conditions, [], [], [])

        assert len(result['chronicConditions']) == 1
        assert result['chronicConditions'][0]['display'] == 'Type 2 Diabetes'

    def test_identify_current_medications(self):
        """Test current medication identification"""
        medications = [
            {
                'id': 'med-1',
                'display': 'Metformin 500mg',
                'isActive': True,
                'dosage': 'One tablet twice daily',
                'startDate': '2020-01-20'
            },
            {
                'id': 'med-2',
                'display': 'Old Medication',
                'isActive': False
            }
        ]

        result = identify_critical_information([], medications, [], [])

        assert len(result['currentMedications']) == 1
        assert result['currentMedications'][0]['display'] == 'Metformin 500mg'

    def test_identify_critical_allergies(self):
        """Test critical allergy identification"""
        allergies = [
            {
                'id': 'allergy-1',
                'display': 'Penicillin',
                'criticality': 'high',
                'clinicalStatus': 'active',
                'type': 'allergy'
            },
            {
                'id': 'allergy-2',
                'display': 'Pollen',
                'criticality': 'low',
                'clinicalStatus': 'active'
            }
        ]

        result = identify_critical_information([], [], allergies, [])

        assert len(result['criticalAllergies']) == 1
        assert result['criticalAllergies'][0]['display'] == 'Penicillin'

    def test_identify_abnormal_lab_results(self):
        """Test abnormal lab result identification"""
        observations = [
            {
                'id': 'obs-1',
                'display': 'Glucose',
                'isLabResult': True,
                'value': 180,
                'unit': 'mg/dL',
                'interpretation': [{'display': 'High'}],
                'effectiveDate': '2024-01-15'
            },
            {
                'id': 'obs-2',
                'display': 'Cholesterol',
                'isLabResult': True,
                'value': 150,
                'unit': 'mg/dL',
                'interpretation': [{'display': 'Normal'}]
            }
        ]

        result = identify_critical_information([], [], [], observations)

        assert len(result['abnormalLabResults']) == 1
        assert result['abnormalLabResults'][0]['display'] == 'Glucose'

    def test_identify_recent_diagnoses(self):
        """Test recent diagnosis identification"""
        recent_date = (datetime.utcnow() - timedelta(days=15)).isoformat()
        old_date = (datetime.utcnow() - timedelta(days=60)).isoformat()

        conditions = [
            {
                'id': 'cond-1',
                'display': 'Recent Condition',
                'recordedDate': recent_date,
                'clinicalStatus': 'active'
            },
            {
                'id': 'cond-2',
                'display': 'Old Condition',
                'recordedDate': old_date,
                'clinicalStatus': 'active'
            }
        ]

        result = identify_critical_information(conditions, [], [], [])

        assert len(result['recentDiagnoses']) == 1
        assert result['recentDiagnoses'][0]['display'] == 'Recent Condition'


class TestCreateChronologicalTimeline:
    """Tests for timeline creation"""

    def test_create_timeline_basic(self):
        """Test basic timeline creation"""
        conditions = [
            {'id': 'cond-1', 'display': 'Diabetes', 'onsetDate': '2020-01-15', 'clinicalStatus': 'active'}
        ]
        medications = [
            {'id': 'med-1', 'display': 'Metformin', 'startDate': '2020-01-20', 'status': 'active'}
        ]
        encounters = [
            {'id': 'enc-1', 'classDisplay': 'Outpatient', 'startDate': '2020-01-10'}
        ]

        result = create_chronological_timeline(conditions, medications, encounters, [], [], [])

        assert len(result) == 3
        # Should be sorted most recent first
        assert result[0]['date'] == '2020-01-20'
        assert result[1]['date'] == '2020-01-15'
        assert result[2]['date'] == '2020-01-10'

    def test_create_timeline_with_all_types(self):
        """Test timeline with all event types"""
        conditions = [{'display': 'Condition', 'onsetDate': '2024-01-01'}]
        medications = [{'display': 'Medication', 'startDate': '2024-01-02'}]
        encounters = [{'classDisplay': 'Visit', 'startDate': '2024-01-03'}]
        observations = [{'display': 'Lab Test', 'effectiveDate': '2024-01-04', 'value': 100, 'unit': 'mg/dL'}]
        procedures = [{'display': 'Surgery', 'performedDate': '2024-01-05'}]
        reports = [{'display': 'X-Ray', 'effectiveDate': '2024-01-06'}]

        result = create_chronological_timeline(
            conditions, medications, encounters, observations, procedures, reports
        )

        assert len(result) == 6
        assert result[0]['type'] == 'diagnosticReport'
        assert result[1]['type'] == 'procedure'
        assert result[2]['type'] == 'observation'
        assert result[3]['type'] == 'encounter'
        assert result[4]['type'] == 'medication'
        assert result[5]['type'] == 'condition'

    def test_create_timeline_filters_missing_dates(self):
        """Test timeline filters out events without dates"""
        conditions = [
            {'display': 'With Date', 'onsetDate': '2024-01-01'},
            {'display': 'Without Date', 'onsetDate': None}
        ]

        result = create_chronological_timeline(conditions, [], [], [], [], [])

        assert len(result) == 1
        assert result[0]['display'] == 'With Date'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
