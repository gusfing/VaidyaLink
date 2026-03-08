"""
Medical Prompt Templates for Clinical Summarization

This module provides enhanced prompt templates for generating clinical summaries
with improved medical accuracy, specialty-specific prompts, and multi-language support.

Features:
- Base medical prompt with enhanced clinical context
- Specialty-specific prompts (cardiology, oncology, pediatrics, etc.)
- Multi-language support for Indian languages
- Medical terminology guidelines
- Safety and accuracy instructions
"""

from typing import Dict, Any, Optional
from enum import Enum


class MedicalSpecialty(Enum):
    """Medical specialties for specialized prompts."""
    GENERAL = "general"
    CARDIOLOGY = "cardiology"
    ONCOLOGY = "oncology"
    PEDIATRICS = "pediatrics"
    ENDOCRINOLOGY = "endocrinology"
    NEUROLOGY = "neurology"
    GASTROENTEROLOGY = "gastroenterology"
    PULMONOLOGY = "pulmonology"
    NEPHROLOGY = "nephrology"
    ORTHOPEDICS = "orthopedics"


class OutputLanguage(Enum):
    """Supported output languages."""
    ENGLISH = "en"
    HINDI = "hi"
    BENGALI = "bn"
    TELUGU = "te"
    MARATHI = "mr"
    TAMIL = "ta"
    GUJARATI = "gu"
    KANNADA = "kn"
    MALAYALAM = "ml"
    PUNJABI = "pa"


# Language display names
LANGUAGE_NAMES = {
    OutputLanguage.ENGLISH: "English",
    OutputLanguage.HINDI: "हिंदी (Hindi)",
    OutputLanguage.BENGALI: "বাংলা (Bengali)",
    OutputLanguage.TELUGU: "తెలుగు (Telugu)",
    OutputLanguage.MARATHI: "मराठी (Marathi)",
    OutputLanguage.TAMIL: "தமிழ் (Tamil)",
    OutputLanguage.GUJARATI: "ગુજરાતી (Gujarati)",
    OutputLanguage.KANNADA: "ಕನ್ನಡ (Kannada)",
    OutputLanguage.MALAYALAM: "മലയാളം (Malayalam)",
    OutputLanguage.PUNJABI: "ਪੰਜਾਬੀ (Punjabi)",
}


class PromptTemplateBuilder:
    """Builder for creating enhanced medical prompts."""

    def __init__(self):
        """Initialize the prompt template builder."""
        self.specialty = MedicalSpecialty.GENERAL
        self.language = OutputLanguage.ENGLISH
        self.max_words = 200
        self.include_medical_context = True
        self.include_safety_instructions = True

    def build_prompt(
        self,
        patient_context: str,
        clinical_context: str,
        specialty: Optional[MedicalSpecialty] = None,
        language: Optional[OutputLanguage] = None,
        max_words: int = 200
    ) -> str:
        """
        Build an enhanced medical prompt.

        Args:
            patient_context: Patient demographic information
            clinical_context: Clinical data context
            specialty: Medical specialty for specialized prompts
            language: Output language
            max_words: Maximum words for summary

        Returns:
            Formatted prompt string
        """
        specialty = specialty or self.specialty
        language = language or self.language
        max_words = max_words or self.max_words

        # Build prompt components
        system_instruction = self._get_system_instruction(specialty, language)
        medical_guidelines = self._get_medical_guidelines(specialty)
        output_format = self._get_output_format(specialty, language)
        safety_instructions = self._get_safety_instructions()

        # Assemble the prompt
        prompt = f"""{system_instruction}

{patient_context}

{clinical_context}

{medical_guidelines}

Generate a structured clinical summary following these requirements:

1. Maximum {max_words} words
2. Bullet-point format
3. {self._get_specialty_focus(specialty)}
4. Include confidence scores (0-100%) for each clinical fact
5. Flag any ambiguous medical terminology that requires clinician review
6. Use chronological order for events
7. Prioritize critical and actionable information

{output_format}

{safety_instructions}

Generate the summary now:"""

        return prompt

    def _get_system_instruction(
        self,
        specialty: MedicalSpecialty,
        language: OutputLanguage
    ) -> str:
        """Get system instruction based on specialty and language."""
        specialty_context = self._get_specialty_context(specialty)
        language_instruction = self._get_language_instruction(language)

        return f"""You are an expert medical AI assistant specializing in {specialty_context}. You are generating a concise clinical summary for a healthcare provider.

{language_instruction}

Your summary must be medically accurate, clinically relevant, and prioritize patient safety."""

    def _get_specialty_context(self, specialty: MedicalSpecialty) -> str:
        """Get specialty-specific context."""
        contexts = {
            MedicalSpecialty.GENERAL: "general medicine and primary care",
            MedicalSpecialty.CARDIOLOGY: "cardiovascular medicine, focusing on heart conditions, cardiac risk factors, and cardiovascular medications",
            MedicalSpecialty.ONCOLOGY: "oncology, focusing on cancer diagnoses, treatment regimens, tumor markers, and chemotherapy protocols",
            MedicalSpecialty.PEDIATRICS: "pediatrics, focusing on child development, growth parameters, pediatric conditions, and age-appropriate care",
            MedicalSpecialty.ENDOCRINOLOGY: "endocrinology, focusing on diabetes, thyroid disorders, hormonal imbalances, and metabolic conditions",
            MedicalSpecialty.NEUROLOGY: "neurology, focusing on neurological conditions, seizures, cognitive function, and neurological medications",
            MedicalSpecialty.GASTROENTEROLOGY: "gastroenterology, focusing on digestive disorders, liver function, GI symptoms, and nutritional status",
            MedicalSpecialty.PULMONOLOGY: "pulmonology, focusing on respiratory conditions, lung function, oxygen therapy, and respiratory medications",
            MedicalSpecialty.NEPHROLOGY: "nephrology, focusing on kidney function, electrolyte balance, dialysis, and renal medications",
            MedicalSpecialty.ORTHOPEDICS: "orthopedics, focusing on musculoskeletal conditions, fractures, joint health, and mobility",
        }
        return contexts.get(specialty, contexts[MedicalSpecialty.GENERAL])

    def _get_language_instruction(self, language: OutputLanguage) -> str:
        """Get language-specific instruction."""
        if language == OutputLanguage.ENGLISH:
            return "Generate the summary in English using standard medical terminology."

        language_name = LANGUAGE_NAMES.get(language, "the specified language")
        return f"""Generate the summary in {language_name}.
- Use appropriate medical terminology in {language_name}
- Maintain clarity and precision in translation
- Keep medication names and technical terms in English if no standard translation exists
- Use culturally appropriate language for the Indian healthcare context"""

    def _get_medical_guidelines(self, specialty: MedicalSpecialty) -> str:
        """Get medical guidelines based on specialty."""
        base_guidelines = """Medical Accuracy Guidelines:
- Use precise medical terminology from standard medical vocabularies (ICD-10, SNOMED CT)
- Verify medication names, dosages, and frequencies are accurate
- Highlight critical values and abnormal findings
- Note any drug interactions or contraindications
- Flag incomplete or ambiguous information"""

        specialty_guidelines = self._get_specialty_guidelines(specialty)

        if specialty_guidelines:
            return f"{base_guidelines}\n\n{specialty_guidelines}"

        return base_guidelines

    def _get_specialty_guidelines(self, specialty: MedicalSpecialty) -> str:
        """Get specialty-specific medical guidelines."""
        guidelines = {
            MedicalSpecialty.CARDIOLOGY: """Cardiology-Specific Guidelines:
- Highlight cardiac risk factors (hypertension, diabetes, smoking, family history)
- Note cardiac medications (antihypertensives, anticoagulants, statins, antiarrhythmics)
- Include relevant cardiac biomarkers (troponin, BNP, lipid panel)
- Mention ECG findings and cardiac imaging results
- Flag any signs of acute coronary syndrome or heart failure""",

            MedicalSpecialty.ONCOLOGY: """Oncology-Specific Guidelines:
- Specify cancer type, stage, and histology
- Include treatment regimen (chemotherapy, radiation, immunotherapy)
- Note tumor markers and their trends
- Mention performance status and functional capacity
- Highlight treatment-related side effects and complications
- Include dates of diagnosis and treatment milestones""",

            MedicalSpecialty.PEDIATRICS: """Pediatrics-Specific Guidelines:
- Include age, weight, and growth percentiles
- Note developmental milestones and immunization status
- Highlight age-appropriate medication dosing
- Mention any congenital conditions or genetic disorders
- Include family history relevant to pediatric care
- Note any behavioral or developmental concerns""",

            MedicalSpecialty.ENDOCRINOLOGY: """Endocrinology-Specific Guidelines:
- Highlight diabetes control (HbA1c, blood glucose trends)
- Note thyroid function tests (TSH, T3, T4)
- Include hormonal medications and insulin regimens
- Mention metabolic syndrome components
- Highlight any endocrine emergencies (DKA, hypoglycemia)
- Note bone health and vitamin D status""",

            MedicalSpecialty.NEUROLOGY: """Neurology-Specific Guidelines:
- Specify neurological diagnoses and symptom patterns
- Note seizure history and control
- Include neurological examination findings
- Mention neuroimaging results (CT, MRI)
- Highlight neurological medications and their effectiveness
- Note cognitive function and mental status""",

            MedicalSpecialty.GASTROENTEROLOGY: """Gastroenterology-Specific Guidelines:
- Highlight GI symptoms (abdominal pain, bleeding, diarrhea)
- Note liver function tests and hepatic conditions
- Include endoscopy and colonoscopy findings
- Mention nutritional status and dietary restrictions
- Highlight any GI bleeding or obstruction
- Note inflammatory bowel disease activity""",

            MedicalSpecialty.PULMONOLOGY: """Pulmonology-Specific Guidelines:
- Highlight respiratory symptoms (dyspnea, cough, wheezing)
- Note pulmonary function tests (spirometry, peak flow)
- Include oxygen saturation and supplemental oxygen needs
- Mention respiratory medications (inhalers, bronchodilators)
- Highlight any acute respiratory distress
- Note smoking history and exposure to respiratory irritants""",

            MedicalSpecialty.NEPHROLOGY: """Nephrology-Specific Guidelines:
- Highlight kidney function (creatinine, eGFR, BUN)
- Note electrolyte imbalances and acid-base status
- Include dialysis status and access
- Mention renal medications and dose adjustments
- Highlight any acute kidney injury
- Note fluid balance and blood pressure control""",

            MedicalSpecialty.ORTHOPEDICS: """Orthopedics-Specific Guidelines:
- Specify musculoskeletal conditions and injuries
- Note fracture details (location, type, healing status)
- Include mobility and functional status
- Mention pain management strategies
- Highlight any surgical interventions
- Note physical therapy and rehabilitation progress""",
        }

        return guidelines.get(specialty, "")

    def _get_specialty_focus(self, specialty: MedicalSpecialty) -> str:
        """Get specialty-specific focus areas for the summary."""
        focus_areas = {
            MedicalSpecialty.GENERAL: "Highlight: chronic conditions, allergies, current medications, recent diagnoses, and preventive care",
            MedicalSpecialty.CARDIOLOGY: "Highlight: cardiac conditions, cardiovascular risk factors, cardiac medications, ECG/imaging findings, and cardiac events",
            MedicalSpecialty.ONCOLOGY: "Highlight: cancer diagnosis and stage, treatment regimen, tumor markers, treatment response, and side effects",
            MedicalSpecialty.PEDIATRICS: "Highlight: growth and development, immunizations, pediatric conditions, family history, and age-appropriate care",
            MedicalSpecialty.ENDOCRINOLOGY: "Highlight: diabetes control, thyroid function, hormonal conditions, metabolic parameters, and endocrine medications",
            MedicalSpecialty.NEUROLOGY: "Highlight: neurological conditions, seizure control, cognitive function, neuroimaging findings, and neurological medications",
            MedicalSpecialty.GASTROENTEROLOGY: "Highlight: GI symptoms, liver function, endoscopy findings, nutritional status, and GI medications",
            MedicalSpecialty.PULMONOLOGY: "Highlight: respiratory symptoms, lung function, oxygen needs, respiratory medications, and smoking history",
            MedicalSpecialty.NEPHROLOGY: "Highlight: kidney function, electrolytes, dialysis status, fluid balance, and renal medications",
            MedicalSpecialty.ORTHOPEDICS: "Highlight: musculoskeletal conditions, fractures, mobility status, pain management, and rehabilitation",
        }
        return focus_areas.get(specialty, focus_areas[MedicalSpecialty.GENERAL])

    def _get_output_format(
        self,
        specialty: MedicalSpecialty,
        language: OutputLanguage
    ) -> str:
        """Get output format instructions."""
        # Base format sections
        sections = [
            "## Chronic Conditions",
            "- [condition] (confidence: X%)",
            "",
            "## Current Medications",
            "- [medication] [dosage] (confidence: X%)",
            "",
            "## Allergies",
            "- [allergen] - [severity] - [reaction]",
            "",
            "## Recent Visits",
            "- [date]: [type] - [reason]",
        ]

        # Add specialty-specific sections
        specialty_sections = self._get_specialty_sections(specialty)
        if specialty_sections:
            sections.extend([""] + specialty_sections)

        # Add common sections
        sections.extend([
            "",
            "## Abnormal Lab Results",
            "- [test]: [value] [unit] ([interpretation]) - [date] (confidence: X%)",
            "",
            "## Recent Diagnoses",
            "- [diagnosis] - [date] (confidence: X%)",
            "",
            "## Flags for Review",
            "- [ambiguous terms or concerns]",
            "",
            "## Overall Confidence Score",
            "[X%]"
        ])

        format_instruction = "Output Format:\n" + "\n".join(sections)

        # Add language-specific format notes
        if language != OutputLanguage.ENGLISH:
            format_instruction += f"\n\nNote: Generate section headers and content in {LANGUAGE_NAMES[language]}, but keep medication names and technical medical terms in English where appropriate."

        return format_instruction

    def _get_specialty_sections(self, specialty: MedicalSpecialty) -> list:
        """Get specialty-specific output sections."""
        specialty_sections = {
            MedicalSpecialty.CARDIOLOGY: [
                "## Cardiac Risk Factors",
                "- [risk factor] - [status]",
                "",
                "## Cardiac Findings",
                "- [finding] - [date] (confidence: X%)"
            ],
            MedicalSpecialty.ONCOLOGY: [
                "## Cancer Details",
                "- Type: [cancer type]",
                "- Stage: [stage]",
                "- Treatment: [regimen]",
                "",
                "## Tumor Markers",
                "- [marker]: [value] - [date] (confidence: X%)"
            ],
            MedicalSpecialty.PEDIATRICS: [
                "## Growth & Development",
                "- Weight: [value] ([percentile])",
                "- Height: [value] ([percentile])",
                "- Developmental milestones: [status]",
                "",
                "## Immunizations",
                "- [vaccine] - [date]"
            ],
            MedicalSpecialty.ENDOCRINOLOGY: [
                "## Diabetes Control",
                "- HbA1c: [value] - [date]",
                "- Blood glucose: [range]",
                "",
                "## Thyroid Function",
                "- TSH: [value] - [date]"
            ],
        }

        return specialty_sections.get(specialty, [])

    def _get_safety_instructions(self) -> str:
        """Get safety and accuracy instructions."""
        return """Safety and Accuracy Instructions:
- If critical information is missing or unclear, explicitly state this in the summary
- Do not infer or assume clinical information that is not present in the data
- Flag any potential drug interactions or contraindications
- Highlight any critical values that require immediate attention
- If confidence in any fact is below 70%, flag it for clinician review
- Maintain patient privacy by not including unnecessary identifying information"""


def get_prompt_template(
    patient_context: str,
    clinical_context: str,
    specialty: str = "general",
    language: str = "en",
    max_words: int = 200
) -> str:
    """
    Get an enhanced prompt template for clinical summarization.

    Args:
        patient_context: Patient demographic information
        clinical_context: Clinical data context
        specialty: Medical specialty (default: "general")
        language: Output language code (default: "en")
        max_words: Maximum words for summary (default: 200)

    Returns:
        Formatted prompt string
    """
    # Convert string inputs to enums
    try:
        specialty_enum = MedicalSpecialty(specialty.lower())
    except ValueError:
        specialty_enum = MedicalSpecialty.GENERAL

    try:
        language_enum = OutputLanguage(language.lower())
    except ValueError:
        language_enum = OutputLanguage.ENGLISH

    # Build and return prompt
    builder = PromptTemplateBuilder()
    return builder.build_prompt(
        patient_context=patient_context,
        clinical_context=clinical_context,
        specialty=specialty_enum,
        language=language_enum,
        max_words=max_words
    )
