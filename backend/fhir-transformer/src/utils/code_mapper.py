"""
Code System Mapper

Maps Indian medical codes to international standards (ICD-10, SNOMED CT, LOINC).
Supports fuzzy matching for Indian medical terminology.
"""

import logging
from typing import Dict, Any, Optional, List
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)


class CodeSystemMapper:
    """
    Maps Indian medical terminology to international code systems.
    Supports ICD-10, SNOMED CT, LOINC, and WHO ATC codes.
    Includes fuzzy matching for term recognition.
    """

    def __init__(self):
        """Initialize Code System Mapper with comprehensive mapping tables"""
        self._init_icd10_mappings()
        self._init_snomed_mappings()
        self._init_loinc_mappings()
        self._init_atc_mappings()

        # Fuzzy matching threshold (0.0 to 1.0)
        self.fuzzy_threshold = 0.85

    def _init_icd10_mappings(self):
        """Initialize ICD-10 diagnosis mappings for common Indian conditions"""
        self.icd10_mappings = {
            # Diabetes
            "type 2 diabetes": {"code": "E11", "display": "Type 2 diabetes mellitus"},
            "type 2 diabetes mellitus": {"code": "E11", "display": "Type 2 diabetes mellitus"},
            "diabetes type 2": {"code": "E11", "display": "Type 2 diabetes mellitus"},
            "type 1 diabetes": {"code": "E10", "display": "Type 1 diabetes mellitus"},
            "type 1 diabetes mellitus": {"code": "E10", "display": "Type 1 diabetes mellitus"},
            "diabetes": {"code": "E11", "display": "Type 2 diabetes mellitus"},
            "dm": {"code": "E11", "display": "Type 2 diabetes mellitus"},
            "niddm": {"code": "E11", "display": "Type 2 diabetes mellitus"},
            "iddm": {"code": "E10", "display": "Type 1 diabetes mellitus"},

            # Hypertension
            "hypertension": {"code": "I10", "display": "Essential (primary) hypertension"},
            "high blood pressure": {"code": "I10", "display": "Essential (primary) hypertension"},
            "htn": {"code": "I10", "display": "Essential (primary) hypertension"},
            "bp": {"code": "I10", "display": "Essential (primary) hypertension"},

            # Respiratory
            "asthma": {"code": "J45", "display": "Asthma"},
            "bronchial asthma": {"code": "J45.9", "display": "Asthma, unspecified"},
            "copd": {"code": "J44", "display": "Chronic obstructive pulmonary disease"},
            "chronic obstructive pulmonary disease": {"code": "J44", "display": "Chronic obstructive pulmonary disease"},
            "tuberculosis": {"code": "A15", "display": "Respiratory tuberculosis"},
            "tb": {"code": "A15", "display": "Respiratory tuberculosis"},
            "pulmonary tuberculosis": {"code": "A15.0", "display": "Tuberculosis of lung"},
            "pneumonia": {"code": "J18", "display": "Pneumonia, unspecified organism"},
            "bronchitis": {"code": "J40", "display": "Bronchitis, not specified as acute or chronic"},

            # Cardiovascular
            "coronary artery disease": {"code": "I25", "display": "Chronic ischemic heart disease"},
            "cad": {"code": "I25", "display": "Chronic ischemic heart disease"},
            "ischemic heart disease": {"code": "I25", "display": "Chronic ischemic heart disease"},
            "ihd": {"code": "I25", "display": "Chronic ischemic heart disease"},
            "myocardial infarction": {"code": "I21", "display": "Acute myocardial infarction"},
            "heart attack": {"code": "I21", "display": "Acute myocardial infarction"},
            "mi": {"code": "I21", "display": "Acute myocardial infarction"},
            "angina": {"code": "I20", "display": "Angina pectoris"},
            "heart failure": {"code": "I50", "display": "Heart failure"},
            "congestive heart failure": {"code": "I50.9", "display": "Heart failure, unspecified"},
            "chf": {"code": "I50.9", "display": "Heart failure, unspecified"},

            # Gastrointestinal
            "gastritis": {"code": "K29", "display": "Gastritis and duodenitis"},
            "peptic ulcer": {"code": "K27", "display": "Peptic ulcer, site unspecified"},
            "gastric ulcer": {"code": "K25", "display": "Gastric ulcer"},
            "duodenal ulcer": {"code": "K26", "display": "Duodenal ulcer"},
            "gerd": {"code": "K21", "display": "Gastro-esophageal reflux disease"},
            "acid reflux": {"code": "K21", "display": "Gastro-esophageal reflux disease"},
            "irritable bowel syndrome": {"code": "K58", "display": "Irritable bowel syndrome"},
            "ibs": {"code": "K58", "display": "Irritable bowel syndrome"},
            "diarrhea": {"code": "A09", "display": "Infectious gastroenteritis and colitis, unspecified"},
            "constipation": {"code": "K59.0", "display": "Constipation"},

            # Infectious diseases
            "malaria": {"code": "B54", "display": "Unspecified malaria"},
            "dengue": {"code": "A90", "display": "Dengue fever"},
            "dengue fever": {"code": "A90", "display": "Dengue fever"},
            "typhoid": {"code": "A01.0", "display": "Typhoid fever"},
            "typhoid fever": {"code": "A01.0", "display": "Typhoid fever"},
            "viral fever": {"code": "B34.9", "display": "Viral infection, unspecified"},
            "hepatitis b": {"code": "B18.1", "display": "Chronic viral hepatitis B"},
            "hepatitis c": {"code": "B18.2", "display": "Chronic viral hepatitis C"},
            "hiv": {"code": "B20", "display": "Human immunodeficiency virus [HIV] disease"},

            # Metabolic
            "hypothyroidism": {"code": "E03", "display": "Other hypothyroidism"},
            "hyperthyroidism": {"code": "E05", "display": "Thyrotoxicosis [hyperthyroidism]"},
            "thyroid disorder": {"code": "E07", "display": "Other disorders of thyroid"},
            "obesity": {"code": "E66", "display": "Obesity"},
            "hyperlipidemia": {"code": "E78", "display": "Disorders of lipoprotein metabolism"},
            "high cholesterol": {"code": "E78.0", "display": "Pure hypercholesterolemia"},

            # Musculoskeletal
            "arthritis": {"code": "M19", "display": "Other and unspecified osteoarthritis"},
            "osteoarthritis": {"code": "M19", "display": "Other and unspecified osteoarthritis"},
            "rheumatoid arthritis": {"code": "M06", "display": "Other rheumatoid arthritis"},
            "back pain": {"code": "M54.5", "display": "Low back pain"},
            "low back pain": {"code": "M54.5", "display": "Low back pain"},
            "neck pain": {"code": "M54.2", "display": "Cervicalgia"},
            "osteoporosis": {"code": "M81", "display": "Osteoporosis without current pathological fracture"},

            # Renal
            "chronic kidney disease": {"code": "N18", "display": "Chronic kidney disease"},
            "ckd": {"code": "N18", "display": "Chronic kidney disease"},
            "kidney failure": {"code": "N19", "display": "Unspecified kidney failure"},
            "renal failure": {"code": "N19", "display": "Unspecified kidney failure"},
            "urinary tract infection": {"code": "N39.0", "display": "Urinary tract infection, site not specified"},
            "uti": {"code": "N39.0", "display": "Urinary tract infection, site not specified"},

            # Neurological
            "migraine": {"code": "G43", "display": "Migraine"},
            "headache": {"code": "R51", "display": "Headache"},
            "epilepsy": {"code": "G40", "display": "Epilepsy and recurrent seizures"},
            "seizure": {"code": "R56", "display": "Convulsions, not elsewhere classified"},
            "stroke": {"code": "I64", "display": "Stroke, not specified as hemorrhage or infarction"},
            "paralysis": {"code": "G83", "display": "Other paralytic syndromes"},

            # Mental health
            "depression": {"code": "F32", "display": "Depressive episode"},
            "anxiety": {"code": "F41", "display": "Other anxiety disorders"},
            "anxiety disorder": {"code": "F41.9", "display": "Anxiety disorder, unspecified"},

            # Other common conditions
            "anemia": {"code": "D64.9", "display": "Anemia, unspecified"},
            "iron deficiency anemia": {"code": "D50", "display": "Iron deficiency anemia"},
            "fever": {"code": "R50.9", "display": "Fever, unspecified"},
            "cough": {"code": "R05", "display": "Cough"},
            "cold": {"code": "J00", "display": "Acute nasopharyngitis [common cold]"},
            "common cold": {"code": "J00", "display": "Acute nasopharyngitis [common cold]"},
            "allergy": {"code": "T78.4", "display": "Allergy, unspecified"},
        }

    def _init_snomed_mappings(self):
        """Initialize SNOMED CT procedure mappings"""
        self.snomed_mappings = {
            # Diagnostic procedures
            "blood pressure measurement": {"code": "271649006", "display": "Blood pressure taking"},
            "bp measurement": {"code": "271649006", "display": "Blood pressure taking"},
            "ecg": {"code": "29303009", "display": "Electrocardiographic procedure"},
            "electrocardiogram": {"code": "29303009", "display": "Electrocardiographic procedure"},
            "ekg": {"code": "29303009", "display": "Electrocardiographic procedure"},
            "x-ray": {"code": "363680008", "display": "Radiographic imaging procedure"},
            "chest x-ray": {"code": "399208008", "display": "Plain chest X-ray"},
            "ultrasound": {"code": "16310003", "display": "Ultrasonography"},
            "ct scan": {"code": "77477000", "display": "Computerized axial tomography"},
            "mri": {"code": "113091000", "display": "Magnetic resonance imaging"},
            "endoscopy": {"code": "423827005", "display": "Endoscopy"},

            # Laboratory procedures
            "blood test": {"code": "396550006", "display": "Blood test"},
            "blood draw": {"code": "396550006", "display": "Blood test"},
            "venipuncture": {"code": "82078001", "display": "Venipuncture"},
            "urine test": {"code": "167217005", "display": "Urine screening test"},
            "urinalysis": {"code": "167217005", "display": "Urine screening test"},

            # Therapeutic procedures
            "injection": {"code": "129326001", "display": "Injection"},
            "iv injection": {"code": "47625008", "display": "Intravenous injection"},
            "intramuscular injection": {"code": "76601001", "display": "Intramuscular injection"},
            "im injection": {"code": "76601001", "display": "Intramuscular injection"},
            "subcutaneous injection": {"code": "34206005", "display": "Subcutaneous injection"},
            "vaccination": {"code": "33879002", "display": "Administration of vaccine to produce active immunity"},
            "immunization": {"code": "33879002", "display": "Administration of vaccine to produce active immunity"},
            "dressing": {"code": "182531007", "display": "Application of dressing"},
            "wound dressing": {"code": "182531007", "display": "Application of dressing"},
            "suturing": {"code": "18557009", "display": "Suture"},
            "stitches": {"code": "18557009", "display": "Suture"},

            # Surgical procedures
            "appendectomy": {"code": "80146002", "display": "Appendectomy"},
            "cholecystectomy": {"code": "38102005", "display": "Cholecystectomy"},
            "cesarean section": {"code": "11466000", "display": "Cesarean section"},
            "c-section": {"code": "11466000", "display": "Cesarean section"},
            "hysterectomy": {"code": "236886002", "display": "Hysterectomy"},
            "cataract surgery": {"code": "54885007", "display": "Extraction of cataract"},

            # Monitoring procedures
            "vital signs": {"code": "118227000", "display": "Vital signs finding"},
            "physical examination": {"code": "5880005", "display": "Physical examination procedure"},
            "general examination": {"code": "5880005", "display": "Physical examination procedure"},
            "consultation": {"code": "11429006", "display": "Consultation"},
            "follow-up": {"code": "308273005", "display": "Follow-up encounter"},
            "follow up": {"code": "308273005", "display": "Follow-up encounter"},

            # Respiratory procedures
            "nebulization": {"code": "426990007", "display": "Nebulizer therapy"},
            "oxygen therapy": {"code": "57485005", "display": "Oxygen therapy"},
            "intubation": {"code": "112798008", "display": "Insertion of endotracheal tube"},

            # Cardiac procedures
            "angiography": {"code": "77343006", "display": "Angiography"},
            "angioplasty": {"code": "81266008", "display": "Angioplasty of blood vessel"},
            "cardiac catheterization": {"code": "41976001", "display": "Cardiac catheterization"},
            "pacemaker insertion": {"code": "25267002", "display": "Insertion of cardiac pacemaker"},

            # Other common procedures
            "dialysis": {"code": "265764009", "display": "Renal dialysis"},
            "hemodialysis": {"code": "302497006", "display": "Hemodialysis"},
            "blood transfusion": {"code": "116859006", "display": "Transfusion of blood product"},
            "physiotherapy": {"code": "91251008", "display": "Physical therapy procedure"},
            "counseling": {"code": "409063005", "display": "Counseling"},
        }

    def _init_loinc_mappings(self):
        """Initialize LOINC mappings for lab tests and observations"""
        # This extends the existing mappings in map_observation_to_loinc
        self.loinc_mappings = {}

    def _init_atc_mappings(self):
        """Initialize WHO ATC medication mappings"""
        self.atc_mappings = {}

    def _fuzzy_match(self, text: str, mapping_dict: Dict[str, Dict[str, str]]) -> Optional[Dict[str, str]]:
        """
        Perform fuzzy matching on text against mapping dictionary

        Args:
            text: Text to match
            mapping_dict: Dictionary of mappings to search

        Returns:
            Best matching code dictionary or None
        """
        text_lower = text.lower().strip()

        # First try exact match
        if text_lower in mapping_dict:
            return mapping_dict[text_lower]

        # Try fuzzy matching
        best_match = None
        best_ratio = 0.0

        for key, value in mapping_dict.items():
            ratio = SequenceMatcher(None, text_lower, key).ratio()
            if ratio > best_ratio and ratio >= self.fuzzy_threshold:
                best_ratio = ratio
                best_match = value

        return best_match

    def map_diagnosis_to_icd10(self, diagnosis: str) -> Optional[Dict[str, str]]:
        """
        Map diagnosis text to ICD-10 code with fuzzy matching support

        Args:
            diagnosis: Diagnosis text in any language

        Returns:
            Dictionary with code, display, and system
        """
        try:
            logger.info(f"Mapping diagnosis to ICD-10: {diagnosis}")

            # Try fuzzy matching against ICD-10 mappings
            match = self._fuzzy_match(diagnosis, self.icd10_mappings)

            if match:
                return {
                    "system": "http://hl7.org/fhir/sid/icd-10",
                    "code": match["code"],
                    "display": match["display"]
                }

            # No match found - return text-only coding
            logger.warning(f"No ICD-10 mapping found for: {diagnosis}")
            return {
                "system": "http://hl7.org/fhir/sid/icd-10",
                "code": None,
                "display": diagnosis
            }

        except Exception as e:
            logger.error(f"Error mapping diagnosis to ICD-10: {str(e)}")
            return None

    def map_medication_to_atc(self, medication: str) -> Optional[Dict[str, str]]:
        """
        Map medication name to WHO ATC code with fuzzy matching support

        Args:
            medication: Medication name

        Returns:
            Dictionary with code, display, and system
        """
        try:
            logger.info(f"Mapping medication to ATC: {medication}")

            # Comprehensive medication mappings for Indian market
            medication_mappings = {
                # Analgesics and antipyretics
                "paracetamol": {"code": "N02BE01", "display": "Paracetamol"},
                "acetaminophen": {"code": "N02BE01", "display": "Paracetamol"},
                "ibuprofen": {"code": "M01AE01", "display": "Ibuprofen"},
                "diclofenac": {"code": "M01AB05", "display": "Diclofenac"},
                "aspirin": {"code": "N02BA01", "display": "Acetylsalicylic acid"},
                "tramadol": {"code": "N02AX02", "display": "Tramadol"},

                # Gastrointestinal
                "omeprazole": {"code": "A02BC01", "display": "Omeprazole"},
                "pantoprazole": {"code": "A02BC02", "display": "Pantoprazole"},
                "ranitidine": {"code": "A02BA02", "display": "Ranitidine"},
                "domperidone": {"code": "A03FA03", "display": "Domperidone"},
                "ondansetron": {"code": "A04AA01", "display": "Ondansetron"},

                # Antibiotics
                "amoxicillin": {"code": "J01CA04", "display": "Amoxicillin"},
                "azithromycin": {"code": "J01FA10", "display": "Azithromycin"},
                "ciprofloxacin": {"code": "J01MA02", "display": "Ciprofloxacin"},
                "doxycycline": {"code": "J01AA02", "display": "Doxycycline"},
                "cefixime": {"code": "J01DD08", "display": "Cefixime"},
                "metronidazole": {"code": "J01XD01", "display": "Metronidazole"},

                # Antidiabetics
                "metformin": {"code": "A10BA02", "display": "Metformin"},
                "glimepiride": {"code": "A10BB12", "display": "Glimepiride"},
                "gliclazide": {"code": "A10BB09", "display": "Gliclazide"},
                "insulin": {"code": "A10AB01", "display": "Insulin (human)"},
                "sitagliptin": {"code": "A10BH01", "display": "Sitagliptin"},

                # Antihypertensives
                "amlodipine": {"code": "C08CA01", "display": "Amlodipine"},
                "atenolol": {"code": "C07AB03", "display": "Atenolol"},
                "metoprolol": {"code": "C07AB02", "display": "Metoprolol"},
                "losartan": {"code": "C09CA01", "display": "Losartan"},
                "telmisartan": {"code": "C09CA07", "display": "Telmisartan"},
                "enalapril": {"code": "C09AA02", "display": "Enalapril"},
                "ramipril": {"code": "C09AA05", "display": "Ramipril"},

                # Lipid lowering
                "atorvastatin": {"code": "C10AA05", "display": "Atorvastatin"},
                "rosuvastatin": {"code": "C10AA07", "display": "Rosuvastatin"},
                "simvastatin": {"code": "C10AA01", "display": "Simvastatin"},

                # Respiratory
                "salbutamol": {"code": "R03AC02", "display": "Salbutamol"},
                "albuterol": {"code": "R03AC02", "display": "Salbutamol"},
                "montelukast": {"code": "R03DC03", "display": "Montelukast"},
                "cetirizine": {"code": "R06AE07", "display": "Cetirizine"},
                "loratadine": {"code": "R06AX13", "display": "Loratadine"},

                # Thyroid
                "levothyroxine": {"code": "H03AA01", "display": "Levothyroxine sodium"},
                "thyroxine": {"code": "H03AA01", "display": "Levothyroxine sodium"},

                # Anticoagulants
                "aspirin": {"code": "B01AC06", "display": "Acetylsalicylic acid"},
                "clopidogrel": {"code": "B01AC04", "display": "Clopidogrel"},
                "warfarin": {"code": "B01AA03", "display": "Warfarin"},

                # Vitamins and supplements
                "vitamin d": {"code": "A11CC05", "display": "Colecalciferol"},
                "vitamin b12": {"code": "B03BA01", "display": "Cyanocobalamin"},
                "folic acid": {"code": "B03BB01", "display": "Folic acid"},
                "iron": {"code": "B03AA07", "display": "Ferrous sulfate"},
                "calcium": {"code": "A12AA04", "display": "Calcium carbonate"},

                # Antidepressants
                "fluoxetine": {"code": "N06AB03", "display": "Fluoxetine"},
                "sertraline": {"code": "N06AB06", "display": "Sertraline"},
                "escitalopram": {"code": "N06AB10", "display": "Escitalopram"},
            }

            # Try fuzzy matching
            match = self._fuzzy_match(medication, medication_mappings)

            if match:
                return {
                    "system": "http://www.whocc.no/atc",
                    "code": match["code"],
                    "display": match["display"]
                }

            # No match found - return text-only coding
            logger.warning(f"No ATC mapping found for: {medication}")
            return {
                "system": "http://www.whocc.no/atc",
                "code": None,
                "display": medication
            }

        except Exception as e:
            logger.error(f"Error mapping medication to ATC: {str(e)}")
            return None

    def map_lab_test_to_loinc(self, test_name: str) -> Optional[Dict[str, str]]:
        """
        Map lab test name to LOINC code with fuzzy matching support

        Args:
            test_name: Lab test name

        Returns:
            Dictionary with code, display, and system
        """
        try:
            logger.info(f"Mapping lab test to LOINC: {test_name}")

            # Comprehensive lab test mappings
            lab_test_mappings = {
                # Blood glucose tests
                "blood glucose": {"code": "2339-0", "display": "Glucose [Mass/volume] in Blood"},
                "glucose": {"code": "2339-0", "display": "Glucose [Mass/volume] in Blood"},
                "fasting glucose": {"code": "1558-6", "display": "Fasting glucose [Mass/volume] in Serum or Plasma"},
                "fasting blood sugar": {"code": "1558-6", "display": "Fasting glucose [Mass/volume] in Serum or Plasma"},
                "fbs": {"code": "1558-6", "display": "Fasting glucose [Mass/volume] in Serum or Plasma"},
                "random blood sugar": {"code": "2339-0", "display": "Glucose [Mass/volume] in Blood"},
                "rbs": {"code": "2339-0", "display": "Glucose [Mass/volume] in Blood"},
                "postprandial glucose": {"code": "1521-4", "display": "Glucose [Mass/volume] in Serum or Plasma --2 hours post dose glucose"},
                "ppbs": {"code": "1521-4", "display": "Glucose [Mass/volume] in Serum or Plasma --2 hours post dose glucose"},

                # Complete blood count
                "hemoglobin": {"code": "718-7", "display": "Hemoglobin [Mass/volume] in Blood"},
                "hb": {"code": "718-7", "display": "Hemoglobin [Mass/volume] in Blood"},
                "hematocrit": {"code": "4544-3", "display": "Hematocrit [Volume Fraction] of Blood"},
                "wbc": {"code": "6690-2", "display": "Leukocytes [#/volume] in Blood"},
                "white blood cell count": {"code": "6690-2", "display": "Leukocytes [#/volume] in Blood"},
                "rbc": {"code": "789-8", "display": "Erythrocytes [#/volume] in Blood"},
                "red blood cell count": {"code": "789-8", "display": "Erythrocytes [#/volume] in Blood"},
                "platelet count": {"code": "777-3", "display": "Platelets [#/volume] in Blood"},
                "platelets": {"code": "777-3", "display": "Platelets [#/volume] in Blood"},

                # Lipid profile
                "cholesterol": {"code": "2093-3", "display": "Cholesterol [Mass/volume] in Serum or Plasma"},
                "total cholesterol": {"code": "2093-3", "display": "Cholesterol [Mass/volume] in Serum or Plasma"},
                "hdl": {"code": "2085-9", "display": "HDL Cholesterol"},
                "hdl cholesterol": {"code": "2085-9", "display": "HDL Cholesterol"},
                "ldl": {"code": "2089-1", "display": "LDL Cholesterol"},
                "ldl cholesterol": {"code": "2089-1", "display": "LDL Cholesterol"},
                "triglycerides": {"code": "2571-8", "display": "Triglyceride [Mass/volume] in Serum or Plasma"},
                "lipid profile": {"code": "24331-1", "display": "Lipid panel - Serum or Plasma"},

                # Kidney function
                "creatinine": {"code": "2160-0", "display": "Creatinine [Mass/volume] in Serum or Plasma"},
                "serum creatinine": {"code": "2160-0", "display": "Creatinine [Mass/volume] in Serum or Plasma"},
                "urea": {"code": "3094-0", "display": "Urea nitrogen [Mass/volume] in Serum or Plasma"},
                "blood urea nitrogen": {"code": "3094-0", "display": "Urea nitrogen [Mass/volume] in Serum or Plasma"},
                "bun": {"code": "3094-0", "display": "Urea nitrogen [Mass/volume] in Serum or Plasma"},
                "uric acid": {"code": "3084-1", "display": "Urate [Mass/volume] in Serum or Plasma"},

                # Liver function
                "sgpt": {"code": "1742-6", "display": "Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma"},
                "alt": {"code": "1742-6", "display": "Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma"},
                "sgot": {"code": "1920-8", "display": "Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma"},
                "ast": {"code": "1920-8", "display": "Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma"},
                "bilirubin": {"code": "1975-2", "display": "Bilirubin.total [Mass/volume] in Serum or Plasma"},
                "total bilirubin": {"code": "1975-2", "display": "Bilirubin.total [Mass/volume] in Serum or Plasma"},
                "alkaline phosphatase": {"code": "6768-6", "display": "Alkaline phosphatase [Enzymatic activity/volume] in Serum or Plasma"},
                "alp": {"code": "6768-6", "display": "Alkaline phosphatase [Enzymatic activity/volume] in Serum or Plasma"},

                # Diabetes monitoring
                "hba1c": {"code": "4548-4", "display": "Hemoglobin A1c/Hemoglobin.total in Blood"},
                "hemoglobin a1c": {"code": "4548-4", "display": "Hemoglobin A1c/Hemoglobin.total in Blood"},
                "glycated hemoglobin": {"code": "4548-4", "display": "Hemoglobin A1c/Hemoglobin.total in Blood"},

                # Thyroid function
                "tsh": {"code": "3016-3", "display": "Thyrotropin [Units/volume] in Serum or Plasma"},
                "thyroid stimulating hormone": {"code": "3016-3", "display": "Thyrotropin [Units/volume] in Serum or Plasma"},
                "t3": {"code": "3051-0", "display": "Triiodothyronine (T3) [Mass/volume] in Serum or Plasma"},
                "t4": {"code": "3053-6", "display": "Thyroxine (T4) [Mass/volume] in Serum or Plasma"},
                "free t3": {"code": "3050-2", "display": "Triiodothyronine (T3) Free [Mass/volume] in Serum or Plasma"},
                "free t4": {"code": "3024-7", "display": "Thyroxine (T4) free [Mass/volume] in Serum or Plasma"},

                # Electrolytes
                "sodium": {"code": "2951-2", "display": "Sodium [Moles/volume] in Serum or Plasma"},
                "potassium": {"code": "2823-3", "display": "Potassium [Moles/volume] in Serum or Plasma"},
                "chloride": {"code": "2075-0", "display": "Chloride [Moles/volume] in Serum or Plasma"},

                # Cardiac markers
                "troponin": {"code": "10839-9", "display": "Troponin I.cardiac [Mass/volume] in Serum or Plasma"},
                "troponin i": {"code": "10839-9", "display": "Troponin I.cardiac [Mass/volume] in Serum or Plasma"},
                "ck-mb": {"code": "13969-1", "display": "Creatine kinase.MB [Mass/volume] in Serum or Plasma"},

                # Urine tests
                "urine routine": {"code": "24357-6", "display": "Urinalysis macro (dipstick) panel - Urine"},
                "urinalysis": {"code": "24357-6", "display": "Urinalysis macro (dipstick) panel - Urine"},
                "urine culture": {"code": "630-4", "display": "Bacteria identified in Urine by Culture"},

                # Infectious disease markers
                "hbsag": {"code": "5196-1", "display": "Hepatitis B virus surface Ag [Presence] in Serum"},
                "hepatitis b surface antigen": {"code": "5196-1", "display": "Hepatitis B virus surface Ag [Presence] in Serum"},
                "hiv test": {"code": "7917-8", "display": "HIV 1 Ab [Presence] in Serum"},
                "dengue ns1": {"code": "6812-2", "display": "Dengue virus Ag [Presence] in Serum"},
                "malaria antigen": {"code": "32700-7", "display": "Plasmodium sp Ag [Presence] in Blood"},

                # Blood pressure (for completeness)
                "blood pressure": {"code": "85354-9", "display": "Blood pressure panel"},
            }

            # Try fuzzy matching
            match = self._fuzzy_match(test_name, lab_test_mappings)

            if match:
                return {
                    "system": "http://loinc.org",
                    "code": match["code"],
                    "display": match["display"]
                }

            # No match found - return text-only coding
            logger.warning(f"No LOINC mapping found for: {test_name}")
            return {
                "system": "http://loinc.org",
                "code": None,
                "display": test_name
            }

        except Exception as e:
            logger.error(f"Error mapping lab test to LOINC: {str(e)}")
            return None

    def map_procedure_to_snomed(self, procedure: str) -> Optional[Dict[str, str]]:
        """
        Map procedure text to SNOMED CT code with fuzzy matching support

        Args:
            procedure: Procedure text

        Returns:
            Dictionary with code, display, and system
        """
        try:
            logger.info(f"Mapping procedure to SNOMED CT: {procedure}")

            # Try fuzzy matching against SNOMED mappings
            match = self._fuzzy_match(procedure, self.snomed_mappings)

            if match:
                return {
                    "system": "http://snomed.info/sct",
                    "code": match["code"],
                    "display": match["display"]
                }

            # No match found - return text-only coding
            logger.warning(f"No SNOMED CT mapping found for: {procedure}")
            return {
                "system": "http://snomed.info/sct",
                "code": None,
                "display": procedure
            }

        except Exception as e:
            logger.error(f"Error mapping procedure to SNOMED CT: {str(e)}")
            return None
    def map_observation_to_loinc(self, observation_name: str) -> Optional[Dict[str, str]]:
        """
        Map observation name to LOINC code

        Supports vital signs, lab tests, and clinical observations

        Args:
            observation_name: Observation name

        Returns:
            Dictionary with code, display, and system
        """
        try:
            logger.info(f"Mapping observation to LOINC: {observation_name}")

            # Common observations mapping (examples)
            # This includes vital signs, lab tests, and clinical observations
            common_mappings = {
                # Vital Signs
                "blood pressure": {"code": "85354-9", "display": "Blood pressure panel"},
                "systolic blood pressure": {"code": "8480-6", "display": "Systolic blood pressure"},
                "diastolic blood pressure": {"code": "8462-4", "display": "Diastolic blood pressure"},
                "heart rate": {"code": "8867-4", "display": "Heart rate"},
                "pulse": {"code": "8867-4", "display": "Heart rate"},
                "respiratory rate": {"code": "9279-1", "display": "Respiratory rate"},
                "body temperature": {"code": "8310-5", "display": "Body temperature"},
                "temperature": {"code": "8310-5", "display": "Body temperature"},
                "oxygen saturation": {"code": "2708-6", "display": "Oxygen saturation in Arterial blood"},
                "spo2": {"code": "2708-6", "display": "Oxygen saturation in Arterial blood"},
                "body weight": {"code": "29463-7", "display": "Body weight"},
                "weight": {"code": "29463-7", "display": "Body weight"},
                "body height": {"code": "8302-2", "display": "Body height"},
                "height": {"code": "8302-2", "display": "Body height"},
                "bmi": {"code": "39156-5", "display": "Body mass index (BMI) [Ratio]"},
                "body mass index": {"code": "39156-5", "display": "Body mass index (BMI) [Ratio]"},

                # Lab Tests
                "blood glucose": {"code": "2339-0", "display": "Glucose [Mass/volume] in Blood"},
                "glucose": {"code": "2339-0", "display": "Glucose [Mass/volume] in Blood"},
                "fasting glucose": {"code": "1558-6", "display": "Fasting glucose [Mass/volume] in Serum or Plasma"},
                "hemoglobin": {"code": "718-7", "display": "Hemoglobin [Mass/volume] in Blood"},
                "hb": {"code": "718-7", "display": "Hemoglobin [Mass/volume] in Blood"},
                "cholesterol": {"code": "2093-3", "display": "Cholesterol [Mass/volume] in Serum or Plasma"},
                "total cholesterol": {"code": "2093-3", "display": "Cholesterol [Mass/volume] in Serum or Plasma"},
                "hdl": {"code": "2085-9", "display": "HDL Cholesterol"},
                "ldl": {"code": "2089-1", "display": "LDL Cholesterol"},
                "triglycerides": {"code": "2571-8", "display": "Triglyceride [Mass/volume] in Serum or Plasma"},
                "creatinine": {"code": "2160-0", "display": "Creatinine [Mass/volume] in Serum or Plasma"},
                "urea": {"code": "3094-0", "display": "Urea nitrogen [Mass/volume] in Serum or Plasma"},
                "hba1c": {"code": "4548-4", "display": "Hemoglobin A1c/Hemoglobin.total in Blood"},
                "hemoglobin a1c": {"code": "4548-4", "display": "Hemoglobin A1c/Hemoglobin.total in Blood"},

                # Clinical Observations
                "pain level": {"code": "72514-3", "display": "Pain severity - 0-10 verbal numeric rating [Score] - Reported"},
                "pain score": {"code": "72514-3", "display": "Pain severity - 0-10 verbal numeric rating [Score] - Reported"}
            }

            obs_lower = observation_name.lower().strip()
            if obs_lower in common_mappings:
                mapping = common_mappings[obs_lower]
                return {
                    "system": "http://loinc.org",
                    "code": mapping["code"],
                    "display": mapping["display"]
                }

            # Fallback to lab test mapping
            return self.map_lab_test_to_loinc(observation_name)

        except Exception as e:
            logger.error(f"Error mapping observation to LOINC: {str(e)}")
            return None


    def enhance_coding(
        self,
        text: str,
        category: str
    ) -> List[Dict[str, str]]:
        """
        Enhance text with multiple code system mappings

        Args:
            text: Medical term text
            category: Category (diagnosis, medication, lab_test, procedure, observation)

        Returns:
            List of coding dictionaries
        """
        try:
            codings = []

            if category == "diagnosis":
                icd10 = self.map_diagnosis_to_icd10(text)
                if icd10:
                    codings.append(icd10)

            elif category == "medication":
                atc = self.map_medication_to_atc(text)
                if atc:
                    codings.append(atc)

            elif category == "lab_test" or category == "observation":
                loinc = self.map_observation_to_loinc(text)
                if loinc:
                    codings.append(loinc)

            elif category == "procedure":
                snomed = self.map_procedure_to_snomed(text)
                if snomed:
                    codings.append(snomed)

            return codings

        except Exception as e:
            logger.error(f"Error enhancing coding: {str(e)}")
            return []

    def get_mapping_statistics(self) -> Dict[str, int]:
        """
        Get statistics about available mappings

        Returns:
            Dictionary with counts of mappings per code system
        """
        return {
            "icd10_mappings": len(self.icd10_mappings),
            "snomed_mappings": len(self.snomed_mappings),
            "atc_mappings": len(self.atc_mappings),
            "fuzzy_threshold": self.fuzzy_threshold
        }
