"""
Unit tests for prompt template builder.

Tests the enhanced prompt engineering system including:
- Base prompt generation
- Specialty-specific prompts
- Multi-language support
- Medical guidelines
- Safety instructions
"""

import pytest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from utils.prompt_templates import (
    PromptTemplateBuilder,
    MedicalSpecialty,
    OutputLanguage,
    get_prompt_template,
    LANGUAGE_NAMES
)


class TestPromptTemplateBuilder:
    """Test suite for PromptTemplateBuilder class."""

    def test_initialization(self):
        """Test builder initialization with defaults."""
        builder = PromptTemplateBuilder()

        assert builder.specialty == MedicalSpecialty.GENERAL
        assert builder.language == OutputLanguage.ENGLISH
        assert builder.max_words == 200
        assert builder.include_medical_context is True
        assert builder.include_safety_instructions is True

    def test_build_basic_prompt(self):
        """Test building a basic general medicine prompt."""
        builder = PromptTemplateBuilder()

        patient_context = "Patient Information:\n- Name: John Doe\n- Age: 45 years\n- Gender: male"
        clinical_context = "Chronic Conditions:\n- Type 2 Diabetes Mellitus"

        prompt = builder.build_prompt(
            patient_context=patient_context,
            clinical_context=clinical_context
        )

        # Verify prompt contains key components
        assert "expert medical ai assistant" in prompt.lower()
        assert "general medicine" in prompt.lower()
        assert patient_context in prompt
        assert clinical_context in prompt
        assert "Maximum 200 words" in prompt
        assert "confidence scores" in prompt.lower()
        assert "Safety and Accuracy Instructions" in prompt

    def test_cardiology_specialty_prompt(self):
        """Test building a cardiology-specific prompt."""
        builder = PromptTemplateBuilder()

        patient_context = "Patient Information:\n- Name: Jane Smith\n- Age: 60 years"
        clinical_context = "Chronic Conditions:\n- Hypertension\n- Coronary Artery Disease"

        prompt = builder.build_prompt(
            patient_context=patient_context,
            clinical_context=clinical_context,
            specialty=MedicalSpecialty.CARDIOLOGY
        )

        # Verify cardiology-specific content
        assert "cardiovascular medicine" in prompt.lower()
        assert "cardiac risk factors" in prompt.lower()
        assert "Cardiology-Specific Guidelines" in prompt
        assert "cardiac medications" in prompt.lower()
        assert "## Cardiac Risk Factors" in prompt
        assert "## Cardiac Findings" in prompt

    def test_oncology_specialty_prompt(self):
        """Test building an oncology-specific prompt."""
        builder = PromptTemplateBuilder()

        patient_context = "Patient Information:\n- Name: Test Patient"
        clinical_context = "Recent Diagnoses:\n- Breast Cancer Stage II"

        prompt = builder.build_prompt(
            patient_context=patient_context,
            clinical_context=clinical_context,
            specialty=MedicalSpecialty.ONCOLOGY
        )

        # Verify oncology-specific content
        assert "oncology" in prompt.lower()
        assert "cancer diagnoses" in prompt.lower()
        assert "Oncology-Specific Guidelines" in prompt
        assert "tumor markers" in prompt.lower()
        assert "## Cancer Details" in prompt
        assert "## Tumor Markers" in prompt

    def test_pediatrics_specialty_prompt(self):
        """Test building a pediatrics-specific prompt."""
        builder = PromptTemplateBuilder()

        patient_context = "Patient Information:\n- Name: Child Patient\n- Age: 5 years"
        clinical_context = "Recent Visits:\n- Well-child checkup"

        prompt = builder.build_prompt(
            patient_context=patient_context,
            clinical_context=clinical_context,
            specialty=MedicalSpecialty.PEDIATRICS
        )

        # Verify pediatrics-specific content
        assert "pediatrics" in prompt.lower()
        assert "child development" in prompt.lower()
        assert "Pediatrics-Specific Guidelines" in prompt
        assert "growth percentiles" in prompt.lower()
        assert "## Growth & Development" in prompt
        assert "## Immunizations" in prompt

    def test_endocrinology_specialty_prompt(self):
        """Test building an endocrinology-specific prompt."""
        builder = PromptTemplateBuilder()

        patient_context = "Patient Information:\n- Name: Test Patient"
        clinical_context = "Chronic Conditions:\n- Type 2 Diabetes Mellitus"

        prompt = builder.build_prompt(
            patient_context=patient_context,
            clinical_context=clinical_context,
            specialty=MedicalSpecialty.ENDOCRINOLOGY
        )

        # Verify endocrinology-specific content
        assert "endocrinology" in prompt.lower()
        assert "diabetes" in prompt.lower()
        assert "Endocrinology-Specific Guidelines" in prompt
        assert "HbA1c" in prompt
        assert "## Diabetes Control" in prompt
        assert "## Thyroid Function" in prompt

    def test_hindi_language_prompt(self):
        """Test building a Hindi language prompt."""
        builder = PromptTemplateBuilder()

        patient_context = "Patient Information:\n- Name: राज कुमार"
        clinical_context = "Chronic Conditions:\n- Type 2 Diabetes"

        prompt = builder.build_prompt(
            patient_context=patient_context,
            clinical_context=clinical_context,
            language=OutputLanguage.HINDI
        )

        # Verify Hindi language instructions
        assert "हिंदी (Hindi)" in prompt
        assert "medical terminology in हिंदी (Hindi)" in prompt
        assert "culturally appropriate language" in prompt.lower()
        assert "Indian healthcare context" in prompt

    def test_tamil_language_prompt(self):
        """Test building a Tamil language prompt."""
        builder = PromptTemplateBuilder()

        patient_context = "Patient Information:\n- Name: Test Patient"
        clinical_context = "Chronic Conditions:\n- Hypertension"

        prompt = builder.build_prompt(
            patient_context=patient_context,
            clinical_context=clinical_context,
            language=OutputLanguage.TAMIL
        )

        # Verify Tamil language instructions
        assert "தமிழ் (Tamil)" in prompt
        assert "medical terminology in தமிழ் (Tamil)" in prompt

    def test_custom_max_words(self):
        """Test building prompt with custom max words."""
        builder = PromptTemplateBuilder()

        patient_context = "Patient Information:\n- Name: Test"
        clinical_context = "Conditions: None"

        prompt = builder.build_prompt(
            patient_context=patient_context,
            clinical_context=clinical_context,
            max_words=150
        )

        assert "Maximum 150 words" in prompt

    def test_get_specialty_context(self):
        """Test specialty context generation."""
        builder = PromptTemplateBuilder()

        # Test various specialties
        general_context = builder._get_specialty_context(MedicalSpecialty.GENERAL)
        assert "general medicine" in general_context.lower()

        cardio_context = builder._get_specialty_context(MedicalSpecialty.CARDIOLOGY)
        assert "cardiovascular" in cardio_context.lower()

        neuro_context = builder._get_specialty_context(MedicalSpecialty.NEUROLOGY)
        assert "neurological" in neuro_context.lower()

    def test_get_language_instruction_english(self):
        """Test English language instruction."""
        builder = PromptTemplateBuilder()

        instruction = builder._get_language_instruction(OutputLanguage.ENGLISH)

        assert "English" in instruction
        assert "standard medical terminology" in instruction.lower()

    def test_get_language_instruction_indian_language(self):
        """Test Indian language instruction."""
        builder = PromptTemplateBuilder()

        instruction = builder._get_language_instruction(OutputLanguage.BENGALI)

        assert "বাংলা (Bengali)" in instruction
        assert "medical terminology" in instruction.lower()
        assert "Indian healthcare context" in instruction

    def test_get_medical_guidelines(self):
        """Test medical guidelines generation."""
        builder = PromptTemplateBuilder()

        # Test general guidelines
        general_guidelines = builder._get_medical_guidelines(MedicalSpecialty.GENERAL)
        assert "Medical Accuracy Guidelines" in general_guidelines
        assert "precise medical terminology" in general_guidelines.lower()
        assert "ICD-10" in general_guidelines
        assert "SNOMED CT" in general_guidelines

        # Test specialty-specific guidelines
        cardio_guidelines = builder._get_medical_guidelines(MedicalSpecialty.CARDIOLOGY)
        assert "Cardiology-Specific Guidelines" in cardio_guidelines
        assert "cardiac risk factors" in cardio_guidelines.lower()

    def test_get_specialty_focus(self):
        """Test specialty focus areas."""
        builder = PromptTemplateBuilder()

        # Test general focus
        general_focus = builder._get_specialty_focus(MedicalSpecialty.GENERAL)
        assert "chronic conditions" in general_focus.lower()
        assert "allergies" in general_focus.lower()

        # Test cardiology focus
        cardio_focus = builder._get_specialty_focus(MedicalSpecialty.CARDIOLOGY)
        assert "cardiac conditions" in cardio_focus.lower()
        assert "cardiovascular risk" in cardio_focus.lower()

    def test_get_output_format(self):
        """Test output format generation."""
        builder = PromptTemplateBuilder()

        # Test general format
        general_format = builder._get_output_format(
            MedicalSpecialty.GENERAL,
            OutputLanguage.ENGLISH
        )
        assert "Output Format:" in general_format
        assert "## Chronic Conditions" in general_format
        assert "## Current Medications" in general_format
        assert "## Allergies" in general_format

        # Test cardiology format with specialty sections
        cardio_format = builder._get_output_format(
            MedicalSpecialty.CARDIOLOGY,
            OutputLanguage.ENGLISH
        )
        assert "## Cardiac Risk Factors" in cardio_format
        assert "## Cardiac Findings" in cardio_format

    def test_get_output_format_with_language(self):
        """Test output format with non-English language."""
        builder = PromptTemplateBuilder()

        hindi_format = builder._get_output_format(
            MedicalSpecialty.GENERAL,
            OutputLanguage.HINDI
        )

        assert "हिंदी (Hindi)" in hindi_format
        assert "medication names" in hindi_format.lower()
        assert "technical medical terms in English" in hindi_format

    def test_get_specialty_sections(self):
        """Test specialty-specific sections."""
        builder = PromptTemplateBuilder()

        # Test cardiology sections
        cardio_sections = builder._get_specialty_sections(MedicalSpecialty.CARDIOLOGY)
        assert len(cardio_sections) > 0
        assert "## Cardiac Risk Factors" in cardio_sections

        # Test oncology sections
        onco_sections = builder._get_specialty_sections(MedicalSpecialty.ONCOLOGY)
        assert "## Cancer Details" in onco_sections
        assert "## Tumor Markers" in onco_sections

        # Test general (no specialty sections)
        general_sections = builder._get_specialty_sections(MedicalSpecialty.GENERAL)
        assert len(general_sections) == 0

    def test_get_safety_instructions(self):
        """Test safety instructions generation."""
        builder = PromptTemplateBuilder()

        safety = builder._get_safety_instructions()

        assert "Safety and Accuracy Instructions" in safety
        assert "critical information is missing" in safety.lower()
        assert "do not infer" in safety.lower()
        assert "drug interactions" in safety.lower()
        assert "patient privacy" in safety.lower()
        assert "70%" in safety  # Confidence threshold

    def test_all_specialties_have_context(self):
        """Test that all specialties have defined context."""
        builder = PromptTemplateBuilder()

        for specialty in MedicalSpecialty:
            context = builder._get_specialty_context(specialty)
            assert len(context) > 0
            assert isinstance(context, str)

    def test_all_specialties_have_focus(self):
        """Test that all specialties have defined focus areas."""
        builder = PromptTemplateBuilder()

        for specialty in MedicalSpecialty:
            focus = builder._get_specialty_focus(specialty)
            assert len(focus) > 0
            assert isinstance(focus, str)
            assert "Highlight:" in focus

    def test_all_languages_have_names(self):
        """Test that all languages have display names."""
        for language in OutputLanguage:
            assert language in LANGUAGE_NAMES
            assert len(LANGUAGE_NAMES[language]) > 0


class TestGetPromptTemplate:
    """Test suite for get_prompt_template helper function."""

    def test_get_prompt_template_basic(self):
        """Test basic prompt template generation."""
        patient_context = "Patient: John Doe"
        clinical_context = "Conditions: Diabetes"

        prompt = get_prompt_template(
            patient_context=patient_context,
            clinical_context=clinical_context
        )

        assert patient_context in prompt
        assert clinical_context in prompt
        assert "expert medical ai assistant" in prompt.lower()

    def test_get_prompt_template_with_specialty(self):
        """Test prompt template with specialty."""
        prompt = get_prompt_template(
            patient_context="Patient: Test",
            clinical_context="Conditions: Heart Disease",
            specialty="cardiology"
        )

        assert "cardiovascular" in prompt.lower()
        assert "cardiac" in prompt.lower()

    def test_get_prompt_template_with_language(self):
        """Test prompt template with language."""
        prompt = get_prompt_template(
            patient_context="Patient: Test",
            clinical_context="Conditions: Test",
            language="hi"
        )

        assert "हिंदी (Hindi)" in prompt

    def test_get_prompt_template_with_max_words(self):
        """Test prompt template with custom max words."""
        prompt = get_prompt_template(
            patient_context="Patient: Test",
            clinical_context="Conditions: Test",
            max_words=150
        )

        assert "Maximum 150 words" in prompt

    def test_get_prompt_template_invalid_specialty(self):
        """Test prompt template with invalid specialty defaults to general."""
        prompt = get_prompt_template(
            patient_context="Patient: Test",
            clinical_context="Conditions: Test",
            specialty="invalid_specialty"
        )

        # Should default to general medicine
        assert "general medicine" in prompt.lower()

    def test_get_prompt_template_invalid_language(self):
        """Test prompt template with invalid language defaults to English."""
        prompt = get_prompt_template(
            patient_context="Patient: Test",
            clinical_context="Conditions: Test",
            language="invalid_lang"
        )

        # Should default to English
        assert "English" in prompt
        assert "standard medical terminology" in prompt.lower()

    def test_get_prompt_template_all_parameters(self):
        """Test prompt template with all parameters."""
        prompt = get_prompt_template(
            patient_context="Patient: Test Patient",
            clinical_context="Conditions: Multiple",
            specialty="oncology",
            language="ta",
            max_words=250
        )

        assert "oncology" in prompt.lower()
        assert "தமிழ் (Tamil)" in prompt
        assert "Maximum 250 words" in prompt
        assert "cancer" in prompt.lower()


class TestLanguageSupport:
    """Test suite for multi-language support."""

    def test_all_supported_languages(self):
        """Test prompt generation for all supported languages."""
        builder = PromptTemplateBuilder()
        patient_context = "Patient: Test"
        clinical_context = "Conditions: Test"

        for language in OutputLanguage:
            prompt = builder.build_prompt(
                patient_context=patient_context,
                clinical_context=clinical_context,
                language=language
            )

            # Verify language name appears in prompt
            language_name = LANGUAGE_NAMES[language]
            if language != OutputLanguage.ENGLISH:
                assert language_name in prompt

            # Verify prompt is well-formed
            assert len(prompt) > 100
            assert "expert medical ai assistant" in prompt.lower()

    def test_language_specific_instructions(self):
        """Test that non-English languages have specific instructions."""
        builder = PromptTemplateBuilder()

        for language in OutputLanguage:
            if language == OutputLanguage.ENGLISH:
                continue

            instruction = builder._get_language_instruction(language)

            # Verify key elements
            assert LANGUAGE_NAMES[language] in instruction
            assert "medical terminology" in instruction.lower()
            assert "Indian healthcare context" in instruction


class TestSpecialtySupport:
    """Test suite for specialty-specific prompts."""

    def test_all_specialties_generate_prompts(self):
        """Test that all specialties can generate valid prompts."""
        builder = PromptTemplateBuilder()
        patient_context = "Patient: Test"
        clinical_context = "Conditions: Test"

        for specialty in MedicalSpecialty:
            prompt = builder.build_prompt(
                patient_context=patient_context,
                clinical_context=clinical_context,
                specialty=specialty
            )

            # Verify prompt is well-formed
            assert len(prompt) > 100
            assert "expert medical ai assistant" in prompt.lower()
            assert "confidence scores" in prompt.lower()

    def test_specialty_guidelines_present(self):
        """Test that specialty-specific guidelines are present."""
        builder = PromptTemplateBuilder()

        specialties_with_guidelines = [
            MedicalSpecialty.CARDIOLOGY,
            MedicalSpecialty.ONCOLOGY,
            MedicalSpecialty.PEDIATRICS,
            MedicalSpecialty.ENDOCRINOLOGY,
            MedicalSpecialty.NEUROLOGY,
            MedicalSpecialty.GASTROENTEROLOGY,
            MedicalSpecialty.PULMONOLOGY,
            MedicalSpecialty.NEPHROLOGY,
            MedicalSpecialty.ORTHOPEDICS,
        ]

        for specialty in specialties_with_guidelines:
            guidelines = builder._get_specialty_guidelines(specialty)
            assert len(guidelines) > 0
            assert "Guidelines" in guidelines


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
