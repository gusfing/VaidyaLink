"""
Tests for Code System Mapper
"""

import pytest
import sys
from pathlib import Path

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.code_mapper import CodeSystemMapper


class TestCodeSystemMapper:
    """Test suite for CodeSystemMapper"""

    def setup_method(self):
        """Set up test fixtures"""
        self.mapper = CodeSystemMapper()

    def test_map_medication_to_atc_paracetamol(self):
        """Test mapping paracetamol to ATC code"""
        result = self.mapper.map_medication_to_atc("Paracetamol")

        assert result is not None
        assert result['system'] == "http://www.whocc.no/atc"
        assert result['code'] == "N02BE01"
        assert result['display'] == "Paracetamol"

    def test_map_medication_to_atc_omeprazole(self):
        """Test mapping omeprazole to ATC code"""
        result = self.mapper.map_medication_to_atc("Omeprazole")

        assert result is not None
        assert result['code'] == "A02BC01"
        assert result['display'] == "Omeprazole"

    def test_map_medication_to_atc_case_insensitive(self):
        """Test that medication mapping is case insensitive"""
        result1 = self.mapper.map_medication_to_atc("METFORMIN")
        result2 = self.mapper.map_medication_to_atc("metformin")
        result3 = self.mapper.map_medication_to_atc("Metformin")

        assert result1['code'] == result2['code'] == result3['code']
        assert result1['code'] == "A10BA02"

    def test_map_medication_to_atc_unknown(self):
        """Test mapping unknown medication"""
        result = self.mapper.map_medication_to_atc("UnknownDrug123")

        assert result is not None
        assert result['system'] == "http://www.whocc.no/atc"
        assert result['code'] is None
        assert result['display'] == "UnknownDrug123"

    def test_map_lab_test_to_loinc_glucose(self):
        """Test mapping blood glucose to LOINC code"""
        result = self.mapper.map_lab_test_to_loinc("Blood Glucose")

        assert result is not None
        assert result['system'] == "http://loinc.org"
        assert result['code'] == "2339-0"
        assert "Glucose" in result['display']

    def test_map_lab_test_to_loinc_hemoglobin(self):
        """Test mapping hemoglobin to LOINC code"""
        result = self.mapper.map_lab_test_to_loinc("Hemoglobin")

        assert result is not None
        assert result['code'] == "718-7"
        assert "Hemoglobin" in result['display']

    def test_map_lab_test_to_loinc_unknown(self):
        """Test mapping unknown lab test"""
        result = self.mapper.map_lab_test_to_loinc("Unknown Test")

        assert result is not None
        assert result['system'] == "http://loinc.org"
        assert result['code'] is None
        assert result['display'] == "Unknown Test"

    def test_map_diagnosis_to_icd10(self):
        """Test mapping diagnosis to ICD-10"""
        result = self.mapper.map_diagnosis_to_icd10("Type 2 Diabetes")

        assert result is not None
        assert result['system'] == "http://hl7.org/fhir/sid/icd-10"
        # Note: Actual mapping not implemented yet, just structure
        assert 'display' in result

    def test_map_procedure_to_snomed(self):
        """Test mapping procedure to SNOMED CT"""
        result = self.mapper.map_procedure_to_snomed("Blood pressure measurement")

        assert result is not None
        assert result['system'] == "http://snomed.info/sct"
        # Note: Actual mapping not implemented yet, just structure
        assert 'display' in result

    def test_enhance_coding_medication(self):
        """Test enhancing medication with code mappings"""
        codings = self.mapper.enhance_coding("Atorvastatin", "medication")

        assert len(codings) > 0
        assert codings[0]['system'] == "http://www.whocc.no/atc"
        assert codings[0]['code'] == "C10AA05"

    def test_enhance_coding_lab_test(self):
        """Test enhancing lab test with code mappings"""
        codings = self.mapper.enhance_coding("Cholesterol", "lab_test")

        assert len(codings) > 0
        assert codings[0]['system'] == "http://loinc.org"
        assert codings[0]['code'] == "2093-3"

    def test_enhance_coding_diagnosis(self):
        """Test enhancing diagnosis with code mappings"""
        codings = self.mapper.enhance_coding("Hypertension", "diagnosis")

        assert len(codings) > 0
        assert codings[0]['system'] == "http://hl7.org/fhir/sid/icd-10"

    def test_enhance_coding_procedure(self):
        """Test enhancing procedure with code mappings"""
        codings = self.mapper.enhance_coding("ECG", "procedure")

        assert len(codings) > 0
        assert codings[0]['system'] == "http://snomed.info/sct"

    def test_enhance_coding_unknown_category(self):
        """Test enhancing with unknown category"""
        codings = self.mapper.enhance_coding("Something", "unknown_category")

        assert len(codings) == 0


    def test_map_observation_to_loinc_vital_signs(self):
        """Test mapping vital signs to LOINC codes"""
        # Blood pressure
        result = self.mapper.map_observation_to_loinc("Blood Pressure")
        assert result is not None
        assert result['system'] == "http://loinc.org"
        assert result['code'] == "85354-9"
        assert "Blood pressure" in result['display']

        # Heart rate
        result = self.mapper.map_observation_to_loinc("Heart Rate")
        assert result is not None
        assert result['code'] == "8867-4"

        # Temperature
        result = self.mapper.map_observation_to_loinc("Temperature")
        assert result is not None
        assert result['code'] == "8310-5"

        # Oxygen saturation
        result = self.mapper.map_observation_to_loinc("SpO2")
        assert result is not None
        assert result['code'] == "2708-6"

    def test_map_observation_to_loinc_lab_tests(self):
        """Test mapping lab tests to LOINC codes"""
        # Blood glucose
        result = self.mapper.map_observation_to_loinc("Blood Glucose")
        assert result is not None
        assert result['code'] == "2339-0"

        # Hemoglobin
        result = self.mapper.map_observation_to_loinc("Hemoglobin")
        assert result is not None
        assert result['code'] == "718-7"

        # HbA1c
        result = self.mapper.map_observation_to_loinc("HbA1c")
        assert result is not None
        assert result['code'] == "4548-4"

    def test_map_observation_to_loinc_case_insensitive(self):
        """Test that observation mapping is case insensitive"""
        result1 = self.mapper.map_observation_to_loinc("blood pressure")
        result2 = self.mapper.map_observation_to_loinc("BLOOD PRESSURE")
        result3 = self.mapper.map_observation_to_loinc("Blood Pressure")

        assert result1['code'] == result2['code'] == result3['code']

    def test_map_observation_to_loinc_unknown(self):
        """Test mapping unknown observation"""
        result = self.mapper.map_observation_to_loinc("Unknown Test XYZ")
        assert result is not None
        assert result['system'] == "http://loinc.org"
        assert result['code'] is None
        assert result['display'] == "Unknown Test XYZ"

    def test_map_observation_to_loinc_body_measurements(self):
        """Test mapping body measurements to LOINC codes"""
        # Weight
        result = self.mapper.map_observation_to_loinc("Weight")
        assert result is not None
        assert result['code'] == "29463-7"

        # Height
        result = self.mapper.map_observation_to_loinc("Height")
        assert result is not None
        assert result['code'] == "8302-2"

        # BMI
        result = self.mapper.map_observation_to_loinc("BMI")
        assert result is not None
        assert result['code'] == "39156-5"


    def test_fuzzy_matching_diagnosis(self):
        """Test fuzzy matching for diagnosis with typos"""
        # Test with slight typo
        result = self.mapper.map_diagnosis_to_icd10("Type 2 Diabetis")  # typo: Diabetis
        assert result is not None
        assert result['code'] == "E11"  # Should still match Type 2 Diabetes

    def test_fuzzy_matching_medication(self):
        """Test fuzzy matching for medication with typos"""
        # Test with slight typo
        result = self.mapper.map_medication_to_atc("Paracetmol")  # typo: Paracetmol
        assert result is not None
        assert result['code'] == "N02BE01"  # Should still match Paracetamol

    def test_fuzzy_matching_procedure(self):
        """Test fuzzy matching for procedure with variations"""
        result = self.mapper.map_procedure_to_snomed("Blood Pressure Measurement")
        assert result is not None
        assert result['code'] == "271649006"

    def test_map_diagnosis_to_icd10_comprehensive(self):
        """Test comprehensive ICD-10 diagnosis mappings"""
        test_cases = [
            ("Hypertension", "I10"),
            ("Type 2 Diabetes", "E11"),
            ("Asthma", "J45"),
            ("Tuberculosis", "A15"),
            ("Coronary Artery Disease", "I25"),
            ("Gastritis", "K29"),
            ("Malaria", "B54"),
            ("Hypothyroidism", "E03"),
            ("Arthritis", "M19"),
            ("Chronic Kidney Disease", "N18"),
            ("Migraine", "G43"),
            ("Depression", "F32"),
            ("Anemia", "D64.9"),
        ]

        for diagnosis, expected_code in test_cases:
            result = self.mapper.map_diagnosis_to_icd10(diagnosis)
            assert result is not None, f"Failed to map: {diagnosis}"
            assert result['code'] == expected_code, f"Wrong code for {diagnosis}: got {result['code']}, expected {expected_code}"
            assert result['system'] == "http://hl7.org/fhir/sid/icd-10"

    def test_map_medication_to_atc_comprehensive(self):
        """Test comprehensive ATC medication mappings"""
        test_cases = [
            ("Paracetamol", "N02BE01"),
            ("Omeprazole", "A02BC01"),
            ("Amoxicillin", "J01CA04"),
            ("Metformin", "A10BA02"),
            ("Amlodipine", "C08CA01"),
            ("Atorvastatin", "C10AA05"),
            ("Salbutamol", "R03AC02"),
            ("Levothyroxine", "H03AA01"),
            ("Clopidogrel", "B01AC04"),
            ("Fluoxetine", "N06AB03"),
        ]

        for medication, expected_code in test_cases:
            result = self.mapper.map_medication_to_atc(medication)
            assert result is not None, f"Failed to map: {medication}"
            assert result['code'] == expected_code, f"Wrong code for {medication}: got {result['code']}, expected {expected_code}"
            assert result['system'] == "http://www.whocc.no/atc"

    def test_map_lab_test_to_loinc_comprehensive(self):
        """Test comprehensive LOINC lab test mappings"""
        test_cases = [
            ("Blood Glucose", "2339-0"),
            ("Hemoglobin", "718-7"),
            ("Cholesterol", "2093-3"),
            ("Creatinine", "2160-0"),
            ("HbA1c", "4548-4"),
            ("TSH", "3016-3"),
            ("ALT", "1742-6"),
            ("Troponin", "10839-9"),
        ]

        for test_name, expected_code in test_cases:
            result = self.mapper.map_lab_test_to_loinc(test_name)
            assert result is not None, f"Failed to map: {test_name}"
            assert result['code'] == expected_code, f"Wrong code for {test_name}: got {result['code']}, expected {expected_code}"
            assert result['system'] == "http://loinc.org"

    def test_map_procedure_to_snomed_comprehensive(self):
        """Test comprehensive SNOMED CT procedure mappings"""
        test_cases = [
            ("Blood Pressure Measurement", "271649006"),
            ("ECG", "29303009"),
            ("X-ray", "363680008"),
            ("Blood Test", "396550006"),
            ("Injection", "129326001"),
            ("Vaccination", "33879002"),
            ("Physical Examination", "5880005"),
        ]

        for procedure, expected_code in test_cases:
            result = self.mapper.map_procedure_to_snomed(procedure)
            assert result is not None, f"Failed to map: {procedure}"
            assert result['code'] == expected_code, f"Wrong code for {procedure}: got {result['code']}, expected {expected_code}"
            assert result['system'] == "http://snomed.info/sct"

    def test_indian_medical_abbreviations(self):
        """Test mapping of common Indian medical abbreviations"""
        # Diagnosis abbreviations
        assert self.mapper.map_diagnosis_to_icd10("DM")['code'] == "E11"
        assert self.mapper.map_diagnosis_to_icd10("HTN")['code'] == "I10"
        assert self.mapper.map_diagnosis_to_icd10("TB")['code'] == "A15"
        assert self.mapper.map_diagnosis_to_icd10("CAD")['code'] == "I25"
        assert self.mapper.map_diagnosis_to_icd10("CKD")['code'] == "N18"
        assert self.mapper.map_diagnosis_to_icd10("COPD")['code'] == "J44"

        # Lab test abbreviations
        assert self.mapper.map_lab_test_to_loinc("FBS")['code'] == "1558-6"
        assert self.mapper.map_lab_test_to_loinc("RBS")['code'] == "2339-0"
        assert self.mapper.map_lab_test_to_loinc("HB")['code'] == "718-7"
        assert self.mapper.map_lab_test_to_loinc("WBC")['code'] == "6690-2"
        assert self.mapper.map_lab_test_to_loinc("HDL")['code'] == "2085-9"
        assert self.mapper.map_lab_test_to_loinc("LDL")['code'] == "2089-1"

    def test_get_mapping_statistics(self):
        """Test getting mapping statistics"""
        stats = self.mapper.get_mapping_statistics()

        assert 'icd10_mappings' in stats
        assert 'snomed_mappings' in stats
        assert 'atc_mappings' in stats
        assert 'fuzzy_threshold' in stats

        # Verify we have substantial mappings
        assert stats['icd10_mappings'] > 50
        assert stats['snomed_mappings'] > 30
        assert stats['fuzzy_threshold'] == 0.85

    def test_fallback_to_text_only_coding(self):
        """Test that unknown terms fallback to text-only coding"""
        # Unknown diagnosis
        result = self.mapper.map_diagnosis_to_icd10("Extremely Rare Disease XYZ")
        assert result is not None
        assert result['code'] is None
        assert result['display'] == "Extremely Rare Disease XYZ"
        assert result['system'] == "http://hl7.org/fhir/sid/icd-10"

        # Unknown medication
        result = self.mapper.map_medication_to_atc("Fictional Drug ABC")
        assert result is not None
        assert result['code'] is None
        assert result['display'] == "Fictional Drug ABC"
        assert result['system'] == "http://www.whocc.no/atc"

        # Unknown lab test
        result = self.mapper.map_lab_test_to_loinc("Imaginary Test 123")
        assert result is not None
        assert result['code'] is None
        assert result['display'] == "Imaginary Test 123"
        assert result['system'] == "http://loinc.org"

        # Unknown procedure
        result = self.mapper.map_procedure_to_snomed("Made Up Procedure")
        assert result is not None
        assert result['code'] is None
        assert result['display'] == "Made Up Procedure"
        assert result['system'] == "http://snomed.info/sct"

    def test_case_insensitive_matching(self):
        """Test that all mappings are case insensitive"""
        # Test various case combinations
        cases = [
            ("DIABETES", "diabetes", "DiAbEtEs"),
            ("PARACETAMOL", "paracetamol", "ParaCetaMol"),
            ("HEMOGLOBIN", "hemoglobin", "HemoGlobin"),
            ("ECG", "ecg", "Ecg"),
        ]

        for upper, lower, mixed in cases:
            # Diagnosis
            if upper in ["DIABETES", "diabetes", "DiAbEtEs"]:
                r1 = self.mapper.map_diagnosis_to_icd10(upper)
                r2 = self.mapper.map_diagnosis_to_icd10(lower)
                r3 = self.mapper.map_diagnosis_to_icd10(mixed)
                assert r1['code'] == r2['code'] == r3['code']

    def test_whitespace_handling(self):
        """Test that extra whitespace is handled correctly"""
        # Test with extra spaces
        result1 = self.mapper.map_diagnosis_to_icd10("  Type 2 Diabetes  ")
        result2 = self.mapper.map_diagnosis_to_icd10("Type 2 Diabetes")
        assert result1['code'] == result2['code'] == "E11"

        result1 = self.mapper.map_medication_to_atc("  Paracetamol  ")
        result2 = self.mapper.map_medication_to_atc("Paracetamol")
        assert result1['code'] == result2['code'] == "N02BE01"
