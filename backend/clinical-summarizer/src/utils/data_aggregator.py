"""
Data Aggregation Pipeline for Clinical Summarizer

This module aggregates FHIR resources into structured clinical data for LLM consumption.
It extracts, categorizes, and chronologically sorts clinical information to prepare
context for Amazon Bedrock summarization.

Key Functions:
- aggregate_clinical_data: Main aggregation function
- extract_patient_demographics: Extract patient information
- extract_conditions: Extract and categorize conditions
- extract_medications: Extract current and past medications
- extract_encounters: Extract clinical visits
- extract_observations: Extract lab results and vital signs
- extract_allergies: Extract allergy information
- extract_diagnostic_reports: Extract diagnostic reports
- identify_critical_information: Flag critical clinical data
- sort_chronologically: Sort events by date
"""

import logging
from typing import Dict, Any, List, Optional, Set
from datetime import datetime, timedelta
from collections import defaultdict

logger = logging.getLogger(__name__)


class DataAggregationError(Exception):
    """Exception for data aggregation errors"""
    pass


def aggregate_clinical_data(
    fhir_resources: List[Dict[str, Any]],
    options: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Aggregate FHIR resources into structured clinical data.

    This function processes a list of FHIR resources and organizes them into
    categories suitable for clinical summarization. It extracts key information,
    identifies critical data, and sorts events chronologically.

    Args:
        fhir_resources: List of FHIR resources (Patient, Condition, Medication, etc.)
        options: Aggregation options (includeLabResults, includeVitalSigns, etc.)

    Returns:
        Aggregated clinical data structure with categorized information

    Example:
        >>> resources = [patient_resource, condition_resource, medication_resource]
        >>> options = {'includeLabResults': True, 'includeVitalSigns': True}
        >>> aggregated = aggregate_clinical_data(resources, options)
        >>> print(aggregated['patient']['name'])
        'John Doe'
    """
    try:
        logger.info(f"Aggregating {len(fhir_resources)} FHIR resources")

        # Group resources by type
        resources_by_type = _group_resources_by_type(fhir_resources)

        # Extract patient demographics
        patient_data = extract_patient_demographics(
            resources_by_type.get('Patient', [])
        )

        # Extract conditions (diagnoses, chronic conditions)
        conditions = extract_conditions(
            resources_by_type.get('Condition', [])
        )

        # Extract medications
        medications = extract_medications(
            resources_by_type.get('MedicationStatement', [])
        )

        # Extract encounters (clinical visits)
        encounters = extract_encounters(
            resources_by_type.get('Encounter', [])
        )

        # Extract allergies
        allergies = extract_allergies(
            resources_by_type.get('AllergyIntolerance', [])
        )

        # Extract observations (lab results, vital signs)
        observations = []
        if options.get('includeLabResults', True) or options.get('includeVitalSigns', True):
            observations = extract_observations(
                resources_by_type.get('Observation', []),
                include_lab_results=options.get('includeLabResults', True),
                include_vital_signs=options.get('includeVitalSigns', True)
            )

        # Extract diagnostic reports
        diagnostic_reports = []
        if options.get('includeDiagnosticReports', True):
            diagnostic_reports = extract_diagnostic_reports(
                resources_by_type.get('DiagnosticReport', [])
            )

        # Extract procedures
        procedures = extract_procedures(
            resources_by_type.get('Procedure', [])
        )

        # Identify critical information
        critical_info = identify_critical_information(
            conditions=conditions,
            medications=medications,
            allergies=allergies,
            observations=observations
        )

        # Sort events chronologically
        timeline = create_chronological_timeline(
            conditions=conditions,
            medications=medications,
            encounters=encounters,
            observations=observations,
            procedures=procedures,
            diagnostic_reports=diagnostic_reports
        )

        # Build aggregated structure
        aggregated_data = {
            'patient': patient_data,
            'conditions': conditions,
            'medications': medications,
            'encounters': encounters,
            'observations': observations,
            'allergies': allergies,
            'procedures': procedures,
            'diagnosticReports': diagnostic_reports,
            'criticalInformation': critical_info,
            'timeline': timeline,
            'metadata': {
                'totalResources': len(fhir_resources),
                'resourceCounts': {
                    resource_type: len(resources)
                    for resource_type, resources in resources_by_type.items()
                },
                'aggregatedAt': datetime.utcnow().isoformat()
            }
        }

        logger.info(f"Aggregation complete: {len(conditions)} conditions, "
                   f"{len(medications)} medications, {len(encounters)} encounters")

        return aggregated_data

    except Exception as e:
        logger.error(f"Error aggregating clinical data: {str(e)}", exc_info=True)
        raise DataAggregationError(f"Failed to aggregate clinical data: {str(e)}")



def _group_resources_by_type(fhir_resources: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Group FHIR resources by resource type.

    Args:
        fhir_resources: List of FHIR resources

    Returns:
        Dictionary mapping resource type to list of resources
    """
    grouped = defaultdict(list)
    for resource in fhir_resources:
        resource_type = resource.get('resourceType')
        if resource_type:
            grouped[resource_type].append(resource)
    return dict(grouped)


def extract_patient_demographics(patient_resources: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Extract patient demographic information.

    Args:
        patient_resources: List of Patient FHIR resources (typically one)

    Returns:
        Patient demographic data
    """
    if not patient_resources:
        logger.warning("No Patient resource found")
        return {}

    # Use the first patient resource
    patient = patient_resources[0]

    # Extract name
    name = _extract_human_name(patient.get('name', []))

    # Extract gender
    gender = patient.get('gender', 'unknown')

    # Extract birth date
    birth_date = patient.get('birthDate')
    age = _calculate_age(birth_date) if birth_date else None

    # Extract contact information
    telecom = patient.get('telecom', [])
    phone = _extract_telecom(telecom, 'phone')
    email = _extract_telecom(telecom, 'email')

    # Extract address
    address = _extract_address(patient.get('address', []))

    # Extract preferred language
    communication = patient.get('communication', [])
    preferred_language = _extract_preferred_language(communication)

    # Extract identifiers (ABHA ID, etc.)
    identifiers = _extract_identifiers(patient.get('identifier', []))

    return {
        'id': patient.get('id'),
        'name': name,
        'gender': gender,
        'birthDate': birth_date,
        'age': age,
        'phone': phone,
        'email': email,
        'address': address,
        'preferredLanguage': preferred_language,
        'identifiers': identifiers
    }



def extract_conditions(condition_resources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Extract and categorize conditions (diagnoses, chronic conditions).

    Args:
        condition_resources: List of Condition FHIR resources

    Returns:
        List of extracted condition data
    """
    conditions = []

    for condition in condition_resources:
        # Extract condition code and display
        code_data = _extract_codeable_concept(condition.get('code', {}))

        # Extract clinical status (active, resolved, etc.)
        clinical_status = _extract_codeable_concept(
            condition.get('clinicalStatus', {})
        ).get('display', 'unknown')

        # Extract verification status
        verification_status = _extract_codeable_concept(
            condition.get('verificationStatus', {})
        ).get('display', 'unknown')

        # Extract onset date
        onset_date = _extract_date_from_onset(condition)

        # Extract recorded date
        recorded_date = condition.get('recordedDate')

        # Determine if chronic condition
        is_chronic = _is_chronic_condition(code_data, clinical_status)

        # Extract severity
        severity = _extract_codeable_concept(
            condition.get('severity', {})
        ).get('display')

        # Extract category
        category = _extract_category(condition.get('category', []))

        conditions.append({
            'id': condition.get('id'),
            'code': code_data.get('code'),
            'display': code_data.get('display'),
            'system': code_data.get('system'),
            'clinicalStatus': clinical_status,
            'verificationStatus': verification_status,
            'onsetDate': onset_date,
            'recordedDate': recorded_date,
            'isChronic': is_chronic,
            'severity': severity,
            'category': category,
            'notes': _extract_notes(condition.get('note', []))
        })

    # Sort by onset date (most recent first)
    conditions.sort(key=lambda c: c.get('onsetDate') or c.get('recordedDate') or '', reverse=True)

    logger.info(f"Extracted {len(conditions)} conditions")
    return conditions



def extract_medications(medication_resources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Extract current and past medications.

    Args:
        medication_resources: List of MedicationStatement FHIR resources

    Returns:
        List of extracted medication data
    """
    medications = []

    for med in medication_resources:
        # Extract medication code
        medication_code = _extract_codeable_concept(
            med.get('medicationCodeableConcept', {})
        )

        # Extract status (active, completed, stopped)
        status = med.get('status', 'unknown')

        # Extract effective period
        effective_period = med.get('effectivePeriod', {})
        effective_date_time = med.get('effectiveDateTime')

        start_date = effective_period.get('start') or effective_date_time
        end_date = effective_period.get('end')

        # Determine if currently active
        is_active = _is_medication_active(status, end_date)

        # Extract dosage information
        dosage_info = _extract_dosage(med.get('dosage', []))

        # Extract reason for medication
        reason = _extract_reason_code(med.get('reasonCode', []))

        medications.append({
            'id': med.get('id'),
            'code': medication_code.get('code'),
            'display': medication_code.get('display'),
            'system': medication_code.get('system'),
            'status': status,
            'isActive': is_active,
            'startDate': start_date,
            'endDate': end_date,
            'dosage': dosage_info,
            'reason': reason,
            'notes': _extract_notes(med.get('note', []))
        })

    # Sort by start date (most recent first)
    medications.sort(key=lambda m: m.get('startDate') or '', reverse=True)

    logger.info(f"Extracted {len(medications)} medications")
    return medications



def extract_encounters(encounter_resources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Extract clinical visits and encounters.

    Args:
        encounter_resources: List of Encounter FHIR resources

    Returns:
        List of extracted encounter data
    """
    encounters = []

    for encounter in encounter_resources:
        # Extract encounter class (inpatient, outpatient, emergency)
        encounter_class = encounter.get('class', {})
        class_code = encounter_class.get('code', 'unknown')
        class_display = encounter_class.get('display', 'unknown')

        # Extract status
        status = encounter.get('status', 'unknown')

        # Extract period
        period = encounter.get('period', {})
        start_date = period.get('start')
        end_date = period.get('end')

        # Extract type
        encounter_type = _extract_codeable_concept_list(encounter.get('type', []))

        # Extract reason for visit
        reason = _extract_reason_code(encounter.get('reasonCode', []))

        # Extract diagnosis
        diagnosis = _extract_encounter_diagnosis(encounter.get('diagnosis', []))

        # Extract service provider
        service_provider = encounter.get('serviceProvider', {}).get('display')

        encounters.append({
            'id': encounter.get('id'),
            'class': class_code,
            'classDisplay': class_display,
            'status': status,
            'startDate': start_date,
            'endDate': end_date,
            'type': encounter_type,
            'reason': reason,
            'diagnosis': diagnosis,
            'serviceProvider': service_provider
        })

    # Sort by start date (most recent first)
    encounters.sort(key=lambda e: e.get('startDate') or '', reverse=True)

    logger.info(f"Extracted {len(encounters)} encounters")
    return encounters



def extract_observations(
    observation_resources: List[Dict[str, Any]],
    include_lab_results: bool = True,
    include_vital_signs: bool = True
) -> List[Dict[str, Any]]:
    """
    Extract lab results and vital signs.

    Args:
        observation_resources: List of Observation FHIR resources
        include_lab_results: Include laboratory results
        include_vital_signs: Include vital signs

    Returns:
        List of extracted observation data
    """
    observations = []

    for obs in observation_resources:
        # Extract observation code
        code_data = _extract_codeable_concept(obs.get('code', {}))

        # Determine observation category
        category = _extract_category(obs.get('category', []))
        category_lower = category.lower() if category else ''
        is_lab_result = 'laboratory' in category_lower
        is_vital_sign = 'vital' in category_lower or 'vital-signs' in category_lower

        # Filter based on options
        if is_lab_result and not include_lab_results:
            continue
        if is_vital_sign and not include_vital_signs:
            continue

        # Extract status
        status = obs.get('status', 'unknown')

        # Extract effective date
        effective_date = obs.get('effectiveDateTime') or obs.get('effectivePeriod', {}).get('start')

        # Extract value
        value_data = _extract_observation_value(obs)

        # Extract interpretation (normal, high, low)
        interpretation = _extract_codeable_concept_list(obs.get('interpretation', []))

        # Extract reference range
        reference_range = _extract_reference_range(obs.get('referenceRange', []))

        observations.append({
            'id': obs.get('id'),
            'code': code_data.get('code'),
            'display': code_data.get('display'),
            'system': code_data.get('system'),
            'category': category,
            'isLabResult': is_lab_result,
            'isVitalSign': is_vital_sign,
            'status': status,
            'effectiveDate': effective_date,
            'value': value_data.get('value'),
            'unit': value_data.get('unit'),
            'valueType': value_data.get('type'),
            'interpretation': interpretation,
            'referenceRange': reference_range,
            'notes': _extract_notes(obs.get('note', []))
        })

    # Sort by effective date (most recent first)
    observations.sort(key=lambda o: o.get('effectiveDate') or '', reverse=True)

    logger.info(f"Extracted {len(observations)} observations")
    return observations



def extract_allergies(allergy_resources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Extract allergy and intolerance information.

    Args:
        allergy_resources: List of AllergyIntolerance FHIR resources

    Returns:
        List of extracted allergy data
    """
    allergies = []

    for allergy in allergy_resources:
        # Extract allergen code
        code_data = _extract_codeable_concept(allergy.get('code', {}))

        # Extract clinical status
        clinical_status = _extract_codeable_concept(
            allergy.get('clinicalStatus', {})
        ).get('display', 'unknown')

        # Extract verification status
        verification_status = _extract_codeable_concept(
            allergy.get('verificationStatus', {})
        ).get('display', 'unknown')

        # Extract type (allergy, intolerance)
        allergy_type = allergy.get('type', 'unknown')

        # Extract category (food, medication, environment)
        categories = allergy.get('category', [])

        # Extract criticality (low, high, unable-to-assess)
        criticality = allergy.get('criticality', 'unknown')

        # Extract onset date
        onset_date = allergy.get('onsetDateTime') or allergy.get('onsetPeriod', {}).get('start')

        # Extract recorded date
        recorded_date = allergy.get('recordedDate')

        # Extract reaction information
        reactions = _extract_allergy_reactions(allergy.get('reaction', []))

        allergies.append({
            'id': allergy.get('id'),
            'code': code_data.get('code'),
            'display': code_data.get('display'),
            'system': code_data.get('system'),
            'clinicalStatus': clinical_status,
            'verificationStatus': verification_status,
            'type': allergy_type,
            'categories': categories,
            'criticality': criticality,
            'onsetDate': onset_date,
            'recordedDate': recorded_date,
            'reactions': reactions,
            'notes': _extract_notes(allergy.get('note', []))
        })

    # Sort by criticality (high first) and recorded date (most recent first)
    allergies.sort(key=lambda a: (
        1 if a.get('criticality') == 'high' else 0,
        a.get('recordedDate') or ''
    ), reverse=True)

    logger.info(f"Extracted {len(allergies)} allergies")
    return allergies



def extract_diagnostic_reports(report_resources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Extract diagnostic reports.

    Args:
        report_resources: List of DiagnosticReport FHIR resources

    Returns:
        List of extracted diagnostic report data
    """
    reports = []

    for report in report_resources:
        # Extract report code
        code_data = _extract_codeable_concept(report.get('code', {}))

        # Extract status
        status = report.get('status', 'unknown')

        # Extract effective date
        effective_date = report.get('effectiveDateTime') or report.get('effectivePeriod', {}).get('start')

        # Extract issued date
        issued_date = report.get('issued')

        # Extract category
        category = _extract_category(report.get('category', []))

        # Extract conclusion
        conclusion = report.get('conclusion')

        # Extract conclusion codes
        conclusion_codes = _extract_codeable_concept_list(report.get('conclusionCode', []))

        # Extract results (references to Observations)
        results = [ref.get('reference') for ref in report.get('result', [])]

        reports.append({
            'id': report.get('id'),
            'code': code_data.get('code'),
            'display': code_data.get('display'),
            'system': code_data.get('system'),
            'status': status,
            'effectiveDate': effective_date,
            'issuedDate': issued_date,
            'category': category,
            'conclusion': conclusion,
            'conclusionCodes': conclusion_codes,
            'resultReferences': results
        })

    # Sort by effective date (most recent first)
    reports.sort(key=lambda r: r.get('effectiveDate') or r.get('issuedDate') or '', reverse=True)

    logger.info(f"Extracted {len(reports)} diagnostic reports")
    return reports


def extract_procedures(procedure_resources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Extract procedure information.

    Args:
        procedure_resources: List of Procedure FHIR resources

    Returns:
        List of extracted procedure data
    """
    procedures = []

    for procedure in procedure_resources:
        # Extract procedure code
        code_data = _extract_codeable_concept(procedure.get('code', {}))

        # Extract status
        status = procedure.get('status', 'unknown')

        # Extract performed date
        performed_date = procedure.get('performedDateTime') or procedure.get('performedPeriod', {}).get('start')

        # Extract category
        category = _extract_codeable_concept(procedure.get('category', {}))

        # Extract reason
        reason = _extract_reason_code(procedure.get('reasonCode', []))

        # Extract outcome
        outcome = _extract_codeable_concept(procedure.get('outcome', {}))

        procedures.append({
            'id': procedure.get('id'),
            'code': code_data.get('code'),
            'display': code_data.get('display'),
            'system': code_data.get('system'),
            'status': status,
            'performedDate': performed_date,
            'category': category.get('display'),
            'reason': reason,
            'outcome': outcome.get('display'),
            'notes': _extract_notes(procedure.get('note', []))
        })

    # Sort by performed date (most recent first)
    procedures.sort(key=lambda p: p.get('performedDate') or '', reverse=True)

    logger.info(f"Extracted {len(procedures)} procedures")
    return procedures



def identify_critical_information(
    conditions: List[Dict[str, Any]],
    medications: List[Dict[str, Any]],
    allergies: List[Dict[str, Any]],
    observations: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Identify and flag critical clinical information.

    Args:
        conditions: List of condition data
        medications: List of medication data
        allergies: List of allergy data
        observations: List of observation data

    Returns:
        Dictionary of critical information flags
    """
    critical_info = {
        'chronicConditions': [],
        'activeConditions': [],
        'currentMedications': [],
        'criticalAllergies': [],
        'abnormalLabResults': [],
        'recentDiagnoses': []
    }

    # Identify chronic conditions
    for condition in conditions:
        if condition.get('isChronic') and condition.get('clinicalStatus') == 'active':
            critical_info['chronicConditions'].append({
                'display': condition.get('display'),
                'onsetDate': condition.get('onsetDate'),
                'severity': condition.get('severity')
            })

    # Identify active conditions
    for condition in conditions:
        if condition.get('clinicalStatus') == 'active':
            critical_info['activeConditions'].append({
                'display': condition.get('display'),
                'onsetDate': condition.get('onsetDate')
            })

    # Identify current medications
    for medication in medications:
        if medication.get('isActive'):
            critical_info['currentMedications'].append({
                'display': medication.get('display'),
                'dosage': medication.get('dosage'),
                'startDate': medication.get('startDate')
            })

    # Identify critical allergies
    for allergy in allergies:
        if allergy.get('criticality') == 'high' and allergy.get('clinicalStatus') == 'active':
            critical_info['criticalAllergies'].append({
                'display': allergy.get('display'),
                'type': allergy.get('type'),
                'reactions': allergy.get('reactions')
            })

    # Identify abnormal lab results
    for observation in observations:
        if observation.get('isLabResult'):
            interpretation = observation.get('interpretation', [])
            if any(i.get('display', '').lower() in ['high', 'low', 'critical', 'abnormal'] for i in interpretation):
                critical_info['abnormalLabResults'].append({
                    'display': observation.get('display'),
                    'value': observation.get('value'),
                    'unit': observation.get('unit'),
                    'interpretation': interpretation,
                    'effectiveDate': observation.get('effectiveDate')
                })

    # Identify recent diagnoses (within last 30 days)
    cutoff_date = (datetime.utcnow() - timedelta(days=30)).isoformat()
    for condition in conditions:
        recorded_date = condition.get('recordedDate', '')
        if recorded_date and recorded_date >= cutoff_date:
            critical_info['recentDiagnoses'].append({
                'display': condition.get('display'),
                'recordedDate': recorded_date,
                'clinicalStatus': condition.get('clinicalStatus')
            })

    logger.info(f"Identified critical information: "
               f"{len(critical_info['chronicConditions'])} chronic conditions, "
               f"{len(critical_info['currentMedications'])} current medications, "
               f"{len(critical_info['criticalAllergies'])} critical allergies")

    return critical_info



def create_chronological_timeline(
    conditions: List[Dict[str, Any]],
    medications: List[Dict[str, Any]],
    encounters: List[Dict[str, Any]],
    observations: List[Dict[str, Any]],
    procedures: List[Dict[str, Any]],
    diagnostic_reports: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Create a chronological timeline of clinical events.

    Args:
        conditions: List of condition data
        medications: List of medication data
        encounters: List of encounter data
        observations: List of observation data
        procedures: List of procedure data
        diagnostic_reports: List of diagnostic report data

    Returns:
        Chronologically sorted list of clinical events
    """
    timeline = []

    # Add conditions to timeline
    for condition in conditions:
        date = condition.get('onsetDate') or condition.get('recordedDate')
        if date:
            timeline.append({
                'date': date,
                'type': 'condition',
                'display': condition.get('display'),
                'status': condition.get('clinicalStatus'),
                'details': condition
            })

    # Add medications to timeline
    for medication in medications:
        date = medication.get('startDate')
        if date:
            timeline.append({
                'date': date,
                'type': 'medication',
                'display': medication.get('display'),
                'status': medication.get('status'),
                'details': medication
            })

    # Add encounters to timeline
    for encounter in encounters:
        date = encounter.get('startDate')
        if date:
            timeline.append({
                'date': date,
                'type': 'encounter',
                'display': encounter.get('classDisplay'),
                'reason': encounter.get('reason'),
                'details': encounter
            })

    # Add observations to timeline
    for observation in observations:
        date = observation.get('effectiveDate')
        if date:
            timeline.append({
                'date': date,
                'type': 'observation',
                'display': observation.get('display'),
                'value': f"{observation.get('value')} {observation.get('unit', '')}".strip(),
                'details': observation
            })

    # Add procedures to timeline
    for procedure in procedures:
        date = procedure.get('performedDate')
        if date:
            timeline.append({
                'date': date,
                'type': 'procedure',
                'display': procedure.get('display'),
                'status': procedure.get('status'),
                'details': procedure
            })

    # Add diagnostic reports to timeline
    for report in diagnostic_reports:
        date = report.get('effectiveDate') or report.get('issuedDate')
        if date:
            timeline.append({
                'date': date,
                'type': 'diagnosticReport',
                'display': report.get('display'),
                'conclusion': report.get('conclusion'),
                'details': report
            })

    # Sort by date (most recent first)
    timeline.sort(key=lambda event: event.get('date', ''), reverse=True)

    logger.info(f"Created timeline with {len(timeline)} events")
    return timeline



# ============================================================================
# Helper Functions for FHIR Data Extraction
# ============================================================================

def _extract_human_name(names: List[Dict[str, Any]]) -> str:
    """Extract human name from FHIR name array."""
    if not names:
        return 'Unknown'

    # Prefer official name
    official_name = next((n for n in names if n.get('use') == 'official'), None)
    name = official_name or names[0]

    # Try text field first
    if name.get('text'):
        return name['text']

    # Build from given and family names
    given = ' '.join(name.get('given', []))
    family = name.get('family', '')

    return f"{given} {family}".strip() or 'Unknown'


def _calculate_age(birth_date: str) -> Optional[int]:
    """Calculate age from birth date."""
    try:
        birth = datetime.fromisoformat(birth_date.replace('Z', '+00:00'))
        today = datetime.utcnow()
        age = today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))
        return age
    except Exception:
        return None


def _extract_telecom(telecom: List[Dict[str, Any]], system: str) -> Optional[str]:
    """Extract telecom value by system (phone, email)."""
    for contact in telecom:
        if contact.get('system') == system:
            return contact.get('value')
    return None


def _extract_address(addresses: List[Dict[str, Any]]) -> Optional[str]:
    """Extract address from FHIR address array."""
    if not addresses:
        return None

    # Prefer home address
    home_address = next((a for a in addresses if a.get('use') == 'home'), None)
    address = home_address or addresses[0]

    # Try text field first
    if address.get('text'):
        return address['text']

    # Build from components
    parts = []
    if address.get('line'):
        parts.extend(address['line'])
    if address.get('city'):
        parts.append(address['city'])
    if address.get('state'):
        parts.append(address['state'])
    if address.get('postalCode'):
        parts.append(address['postalCode'])
    if address.get('country'):
        parts.append(address['country'])

    return ', '.join(parts) if parts else None


def _extract_preferred_language(communication: List[Dict[str, Any]]) -> Optional[str]:
    """Extract preferred language from communication array."""
    for comm in communication:
        if comm.get('preferred'):
            language = comm.get('language', {})
            coding = language.get('coding', [])
            if coding:
                return coding[0].get('display') or coding[0].get('code')
    return None


def _extract_identifiers(identifiers: List[Dict[str, Any]]) -> Dict[str, str]:
    """Extract identifiers (ABHA ID, etc.)."""
    result = {}
    for identifier in identifiers:
        system = identifier.get('system', '')
        value = identifier.get('value')
        if value:
            if 'abha' in system.lower():
                result['abhaId'] = value
            else:
                # Use last part of system URL as key
                key = system.split('/')[-1] if '/' in system else 'identifier'
                result[key] = value
    return result



def _extract_codeable_concept(codeable_concept: Dict[str, Any]) -> Dict[str, Any]:
    """Extract code, display, and system from CodeableConcept."""
    if not codeable_concept:
        return {}

    # Try text field first
    text = codeable_concept.get('text')

    # Extract from coding array
    coding = codeable_concept.get('coding', [])
    if coding:
        first_coding = coding[0]
        return {
            'code': first_coding.get('code'),
            'display': first_coding.get('display') or text,
            'system': first_coding.get('system')
        }

    return {'display': text} if text else {}


def _extract_codeable_concept_list(codeable_concepts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract list of codeable concepts."""
    return [_extract_codeable_concept(cc) for cc in codeable_concepts]


def _extract_category(categories: List[Dict[str, Any]]) -> Optional[str]:
    """Extract category display from category array."""
    if not categories:
        return None

    category = categories[0]
    coding = category.get('coding', [])
    if coding:
        return coding[0].get('display') or coding[0].get('code')

    return category.get('text')


def _extract_notes(notes: List[Dict[str, Any]]) -> List[str]:
    """Extract note text from note array."""
    return [note.get('text') for note in notes if note.get('text')]


def _extract_date_from_onset(condition: Dict[str, Any]) -> Optional[str]:
    """Extract onset date from various onset fields."""
    if condition.get('onsetDateTime'):
        return condition['onsetDateTime']
    if condition.get('onsetPeriod'):
        return condition['onsetPeriod'].get('start')
    if condition.get('onsetAge'):
        # Cannot convert age to date without birth date
        return None
    if condition.get('onsetRange'):
        # Use low value if available
        low = condition['onsetRange'].get('low', {})
        return low.get('value')
    if condition.get('onsetString'):
        # String representation, cannot parse reliably
        return None
    return None


def _is_chronic_condition(code_data: Dict[str, Any], clinical_status: str) -> bool:
    """
    Determine if a condition is chronic based on code and status.

    This is a simplified heuristic. In production, this would use
    a comprehensive chronic condition code list.
    """
    if clinical_status != 'active':
        return False

    # Common chronic condition keywords
    chronic_keywords = [
        'diabetes', 'hypertension', 'asthma', 'copd', 'arthritis',
        'chronic', 'heart failure', 'kidney disease', 'liver disease',
        'cancer', 'hiv', 'epilepsy', 'parkinson', 'alzheimer'
    ]

    display = (code_data.get('display') or '').lower()
    return any(keyword in display for keyword in chronic_keywords)


def _extract_dosage(dosages: List[Dict[str, Any]]) -> Optional[str]:
    """Extract dosage information as human-readable string."""
    if not dosages:
        return None

    dosage = dosages[0]

    # Try text field first
    if dosage.get('text'):
        return dosage['text']

    # Build from components
    parts = []

    # Dose and rate
    dose_and_rate = dosage.get('doseAndRate', [])
    if dose_and_rate:
        dose_quantity = dose_and_rate[0].get('doseQuantity', {})
        value = dose_quantity.get('value')
        unit = dose_quantity.get('unit')
        if value:
            parts.append(f"{value} {unit}" if unit else str(value))

    # Timing
    timing = dosage.get('timing', {})
    repeat = timing.get('repeat', {})
    frequency = repeat.get('frequency')
    period = repeat.get('period')
    period_unit = repeat.get('periodUnit')

    if frequency and period:
        parts.append(f"{frequency} time(s) per {period} {period_unit}")

    # Route
    route = dosage.get('route', {})
    route_display = _extract_codeable_concept(route).get('display')
    if route_display:
        parts.append(f"via {route_display}")

    return ' '.join(parts) if parts else None


def _extract_reason_code(reason_codes: List[Dict[str, Any]]) -> Optional[str]:
    """Extract reason code display."""
    if not reason_codes:
        return None

    reason = _extract_codeable_concept(reason_codes[0])
    return reason.get('display')


def _is_medication_active(status: str, end_date: Optional[str]) -> bool:
    """Determine if medication is currently active."""
    if status not in ['active', 'intended', 'on-hold']:
        return False

    if end_date:
        try:
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            return end > datetime.utcnow()
        except Exception:
            pass

    return True



def _extract_encounter_diagnosis(diagnoses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract diagnosis information from encounter."""
    result = []
    for diagnosis in diagnoses:
        condition_ref = diagnosis.get('condition', {}).get('reference')
        use = diagnosis.get('use', {})
        use_display = _extract_codeable_concept(use).get('display')

        result.append({
            'conditionReference': condition_ref,
            'use': use_display,
            'rank': diagnosis.get('rank')
        })
    return result


def _extract_observation_value(observation: Dict[str, Any]) -> Dict[str, Any]:
    """Extract value from observation (handles multiple value types)."""
    # Try different value types
    if observation.get('valueQuantity'):
        quantity = observation['valueQuantity']
        return {
            'value': quantity.get('value'),
            'unit': quantity.get('unit'),
            'type': 'Quantity'
        }

    if observation.get('valueCodeableConcept'):
        concept = _extract_codeable_concept(observation['valueCodeableConcept'])
        return {
            'value': concept.get('display'),
            'unit': None,
            'type': 'CodeableConcept'
        }

    if observation.get('valueString'):
        return {
            'value': observation['valueString'],
            'unit': None,
            'type': 'String'
        }

    if observation.get('valueBoolean') is not None:
        return {
            'value': observation['valueBoolean'],
            'unit': None,
            'type': 'Boolean'
        }

    if observation.get('valueInteger') is not None:
        return {
            'value': observation['valueInteger'],
            'unit': None,
            'type': 'Integer'
        }

    if observation.get('valueRange'):
        value_range = observation['valueRange']
        low = value_range.get('low', {}).get('value')
        high = value_range.get('high', {}).get('value')
        unit = value_range.get('low', {}).get('unit')
        return {
            'value': f"{low}-{high}",
            'unit': unit,
            'type': 'Range'
        }

    return {'value': None, 'unit': None, 'type': 'Unknown'}


def _extract_reference_range(reference_ranges: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Extract reference range from observation."""
    if not reference_ranges:
        return None

    ref_range = reference_ranges[0]
    low = ref_range.get('low', {})
    high = ref_range.get('high', {})

    return {
        'low': low.get('value'),
        'high': high.get('value'),
        'unit': low.get('unit') or high.get('unit'),
        'text': ref_range.get('text')
    }


def _extract_allergy_reactions(reactions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Extract allergy reaction information."""
    result = []
    for reaction in reactions:
        # Extract manifestation
        manifestations = reaction.get('manifestation', [])
        manifestation_displays = [
            _extract_codeable_concept(m).get('display')
            for m in manifestations
        ]

        # Extract severity
        severity = reaction.get('severity', 'unknown')

        result.append({
            'manifestations': manifestation_displays,
            'severity': severity,
            'description': reaction.get('description')
        })

    return result
