"""
FHIR Resource Builder

Utility class for building FHIR R4 resources using fhir.resources library.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from fhir.resources.patient import Patient
from fhir.resources.humanname import HumanName
from fhir.resources.identifier import Identifier
from fhir.resources.contactpoint import ContactPoint
from fhir.resources.address import Address
from fhir.resources.codeableconcept import CodeableConcept
from fhir.resources.codeablereference import CodeableReference
from fhir.resources.coding import Coding
from fhir.resources.medicationstatement import MedicationStatement
from fhir.resources.dosage import Dosage
from fhir.resources.timing import Timing, TimingRepeat
from fhir.resources.observation import Observation, ObservationReferenceRange
from fhir.resources.quantity import Quantity
from fhir.resources.range import Range
from fhir.resources.encounter import Encounter
from fhir.resources.diagnosticreport import DiagnosticReport
from fhir.resources.bundle import Bundle, BundleEntry
from fhir.resources.reference import Reference
from fhir.resources.period import Period
from fhir.resources.annotation import Annotation

from .code_mapper import CodeSystemMapper

logger = logging.getLogger(__name__)


class FHIRResourceBuilder:
    """
    Builder class for creating FHIR R4 resources from structured clinical data.
    Uses fhir.resources library for type-safe resource construction.
    """

    def __init__(self):
        """Initialize FHIR Resource Builder"""
        self.resources = []
        self.code_mapper = CodeSystemMapper()

    def create_patient(self, patient_data: Dict[str, Any]) -> Patient:
        """
        Create a FHIR Patient resource

        Args:
            patient_data: Dictionary containing patient information
                {
                    "patientId": str,
                    "abhaId": str (optional),
                    "name": str,
                    "familyName": str (optional),
                    "givenName": str (optional),
                    "gender": str,
                    "birthDate": str (ISO format),
                    "phone": str (optional),
                    "email": str (optional),
                    "address": dict (optional),
                    "preferredLanguage": str (optional)
                }

        Returns:
            Patient: FHIR Patient resource
        """
        try:
            logger.info(f"Creating Patient resource for: {patient_data.get('patientId')}")

            # Build identifiers
            identifiers = []
            if patient_data.get('patientId'):
                identifiers.append(
                    Identifier(
                        system="https://vaidyalink.com/patient-id",
                        value=patient_data['patientId']
                    )
                )

            if patient_data.get('abhaId'):
                identifiers.append(
                    Identifier(
                        system="https://abdm.gov.in/abha",
                        value=patient_data['abhaId']
                    )
                )

            # Build name
            name_parts = []
            if patient_data.get('name'):
                name_parts.append(
                    HumanName(
                        use="official",
                        text=patient_data['name'],
                        family=patient_data.get('familyName'),
                        given=[patient_data.get('givenName')] if patient_data.get('givenName') else None
                    )
                )

            # Build telecom
            telecom = []
            if patient_data.get('phone'):
                telecom.append(
                    ContactPoint(
                        system="phone",
                        value=patient_data['phone']
                    )
                )
            if patient_data.get('email'):
                telecom.append(
                    ContactPoint(
                        system="email",
                        value=patient_data['email']
                    )
                )

            # Build address
            addresses = []
            if patient_data.get('address'):
                addr_data = patient_data['address']
                addresses.append(
                    Address(
                        use="home",
                        line=[addr_data.get('line')] if addr_data.get('line') else None,
                        city=addr_data.get('city'),
                        state=addr_data.get('state'),
                        postalCode=addr_data.get('postalCode'),
                        country=addr_data.get('country', 'IN')
                    )
                )

            # Build communication
            communication = []
            if patient_data.get('preferredLanguage'):
                communication.append({
                    "language": CodeableConcept(
                        coding=[
                            Coding(
                                system="urn:ietf:bcp:47",
                                code=patient_data['preferredLanguage']
                            )
                        ]
                    ),
                    "preferred": True
                })

            # Create Patient resource
            patient = Patient(
                identifier=identifiers if identifiers else None,
                name=name_parts if name_parts else None,
                telecom=telecom if telecom else None,
                gender=patient_data.get('gender'),
                birthDate=patient_data.get('birthDate'),
                address=addresses if addresses else None,
                communication=communication if communication else None
            )

            logger.info(f"Successfully created Patient resource: {patient.id}")
            return patient

        except Exception as e:
            logger.error(f"Error creating Patient resource: {str(e)}")
            raise

    def create_medication_statement(
        self,
        medication_data: Dict[str, Any],
        patient_reference: str
    ) -> MedicationStatement:
        """
        Create a FHIR MedicationStatement resource

        Args:
            medication_data: Dictionary containing medication information
                {
                    "medicationName": str,  # Drug name (will be mapped to ATC)
                    "text": str (optional),  # Display text
                    "code": str (optional),  # Pre-mapped ATC code
                    "display": str (optional),  # Pre-mapped display name
                    "codeSystem": str (optional),  # Code system URI
                    "status": str (default: "active"),
                    "effectiveStart": str (optional),  # ISO date
                    "effectiveEnd": str (optional),  # ISO date
                    "dosage": {
                        "text": str,  # Human-readable dosage
                        "doseValue": float (optional),
                        "doseUnit": str (optional),
                        "frequency": int (optional),  # e.g., 1, 2, 3
                        "period": float (optional),  # e.g., 1
                        "periodUnit": str (optional),  # d, h, wk, mo
                        "routeCode": str (optional),  # SNOMED CT code
                        "routeDisplay": str (optional)
                    },
                    "confidence": float (optional),  # 0-1 or 0-100
                    "extractionDate": str (optional),  # ISO date
                    "note": str (optional)
                }
            patient_reference: Reference to Patient resource (e.g., "Patient/patient-123")

        Returns:
            MedicationStatement: FHIR MedicationStatement resource
        """
        try:
            logger.info(f"Creating MedicationStatement resource for medication: {medication_data.get('medicationName', medication_data.get('text'))}")

            # Map medication name to ATC code if not already provided
            medication_codings = []
            medication_text = medication_data.get('text', medication_data.get('medicationName', ''))

            if medication_data.get('code'):
                # Use provided code
                medication_codings.append(
                    Coding(
                        system=medication_data.get('codeSystem', 'http://www.whocc.no/atc'),
                        code=medication_data['code'],
                        display=medication_data.get('display', medication_text)
                    )
                )
            elif medication_data.get('medicationName'):
                # Map Indian drug name to ATC code
                atc_mapping = self.code_mapper.map_medication_to_atc(medication_data['medicationName'])
                if atc_mapping and atc_mapping.get('code'):
                    medication_codings.append(
                        Coding(
                            system=atc_mapping['system'],
                            code=atc_mapping['code'],
                            display=atc_mapping['display']
                        )
                    )
                    logger.info(f"Mapped {medication_data['medicationName']} to ATC code {atc_mapping['code']}")

            # Build medication codeable concept
            medication_concept = CodeableConcept(
                coding=medication_codings if medication_codings else None,
                text=medication_text
            )

            # Wrap in CodeableReference for FHIR R4
            medication_reference = CodeableReference(concept=medication_concept)

            # Build dosage with timing
            dosage_list = []
            if medication_data.get('dosage'):
                dosage_data = medication_data['dosage']

                # Build timing structure
                timing = None
                if dosage_data.get('frequency') or dosage_data.get('period'):
                    timing_repeat = TimingRepeat(
                        frequency=dosage_data.get('frequency'),
                        period=dosage_data.get('period'),
                        periodUnit=dosage_data.get('periodUnit', 'd')  # Default to daily
                    )
                    timing = Timing(repeat=timing_repeat)

                # Build route
                route = None
                if dosage_data.get('routeCode') or dosage_data.get('routeDisplay'):
                    route = CodeableConcept(
                        coding=[
                            Coding(
                                system="http://snomed.info/sct",
                                code=dosage_data.get('routeCode', '26643006'),  # Default to oral
                                display=dosage_data.get('routeDisplay', 'Oral route')
                            )
                        ]
                    )

                # Build dose and rate
                dose_and_rate = None
                if dosage_data.get('doseValue'):
                    dose_and_rate = [{
                        "doseQuantity": Quantity(
                            value=dosage_data['doseValue'],
                            unit=dosage_data.get('doseUnit', 'mg'),
                            system="http://unitsofmeasure.org",
                            code=dosage_data.get('doseUnit', 'mg')
                        )
                    }]

                dosage_list.append(
                    Dosage(
                        text=dosage_data.get('text'),
                        timing=timing,
                        route=route,
                        doseAndRate=dose_and_rate
                    )
                )

            # Build effective period
            effective_period = None
            if medication_data.get('effectiveStart'):
                effective_period = Period(
                    start=medication_data['effectiveStart'],
                    end=medication_data.get('effectiveEnd')
                )

            # Build notes with confidence score
            notes = []
            note_text = medication_data.get('note', '')

            # Add confidence score to note if provided
            if medication_data.get('confidence') is not None:
                confidence = medication_data['confidence']
                # Normalize confidence to percentage if it's between 0-1
                if confidence <= 1.0:
                    confidence = confidence * 100

                confidence_text = f"Confidence: {confidence:.0f}%"

                if medication_data.get('extractionDate'):
                    confidence_text = f"Extracted from handwritten prescription dated {medication_data['extractionDate']}. {confidence_text}"

                if note_text:
                    note_text = f"{note_text}. {confidence_text}"
                else:
                    note_text = confidence_text

            if note_text:
                notes.append(Annotation(text=note_text))

            # Create MedicationStatement resource
            med_statement = MedicationStatement(
                status=medication_data.get('status', 'active'),
                medication=medication_reference,
                subject=Reference(reference=patient_reference),
                effectivePeriod=effective_period,
                dosage=dosage_list if dosage_list else None,
                note=notes if notes else None
            )

            logger.info(f"Successfully created MedicationStatement resource")
            return med_statement

        except Exception as e:
            logger.error(f"Error creating MedicationStatement resource: {str(e)}")
            raise

    def create_observation(
        self,
        observation_data: Dict[str, Any],
        patient_reference: str
    ) -> Observation:
        """
        Create a FHIR Observation resource

        Supports multiple observation types:
        - Vital signs (blood pressure, heart rate, temperature, etc.)
        - Lab results (blood glucose, cholesterol, etc.)
        - Clinical observations (pain level, symptoms, etc.)

        Supports multiple value types:
        - Quantity (numeric values with units)
        - String (text values)
        - CodeableConcept (coded values)
        - Boolean (yes/no values)
        - Range (min-max values)

        Args:
            observation_data: Dictionary containing observation information
            patient_reference: Reference to Patient resource

        Returns:
            Observation: FHIR Observation resource
        """
        try:
            logger.info(f"Creating Observation resource")

            # Build code - use code mapper if only name provided
            code_data = observation_data.get('code')
            code_system = observation_data.get('codeSystem', 'http://loinc.org')
            code_display = observation_data.get('display')

            # If no code but observationName provided, try to map it
            if not code_data and observation_data.get('observationName'):
                mapped_code = self.code_mapper.map_observation_to_loinc(
                    observation_data['observationName']
                )
                if mapped_code:
                    code_data = mapped_code['code']
                    code_display = mapped_code['display']

            code = CodeableConcept(
                coding=[
                    Coding(
                        system=code_system,
                        code=code_data,
                        display=code_display
                    )
                ] if code_data else None,
                text=observation_data.get('text') or observation_data.get('observationName')
            )

            # Build category (vital-signs, laboratory, etc.)
            category = None
            if observation_data.get('category'):
                category = [
                    CodeableConcept(
                        coding=[
                            Coding(
                                system="http://terminology.hl7.org/CodeSystem/observation-category",
                                code=observation_data['category'],
                                display=observation_data.get('categoryDisplay')
                            )
                        ]
                    )
                ]

            # Build value based on type
            value_quantity = None
            value_string = None
            value_codeable_concept = None
            value_boolean = None
            value_range = None

            if observation_data.get('valueQuantity'):
                value_data = observation_data['valueQuantity']
                value_quantity = Quantity(
                    value=value_data.get('value'),
                    unit=value_data.get('unit'),
                    system="http://unitsofmeasure.org",
                    code=value_data.get('code', value_data.get('unit'))
                )
            elif observation_data.get('valueString'):
                value_string = observation_data['valueString']
            elif observation_data.get('valueCodeableConcept'):
                value_cc_data = observation_data['valueCodeableConcept']
                value_codeable_concept = CodeableConcept(
                    coding=[
                        Coding(
                            system=value_cc_data.get('system', 'http://snomed.info/sct'),
                            code=value_cc_data.get('code'),
                            display=value_cc_data.get('display')
                        )
                    ] if value_cc_data.get('code') else None,
                    text=value_cc_data.get('text')
                )
            elif observation_data.get('valueBoolean') is not None:
                value_boolean = observation_data['valueBoolean']
            elif observation_data.get('valueRange'):
                range_data = observation_data['valueRange']
                value_range = Range(
                    low=Quantity(
                        value=range_data.get('low'),
                        unit=range_data.get('unit'),
                        system="http://unitsofmeasure.org"
                    ) if range_data.get('low') is not None else None,
                    high=Quantity(
                        value=range_data.get('high'),
                        unit=range_data.get('unit'),
                        system="http://unitsofmeasure.org"
                    ) if range_data.get('high') is not None else None
                )

            # Build interpretation (normal, high, low, etc.)
            interpretation = None
            if observation_data.get('interpretation'):
                interpretation = [
                    CodeableConcept(
                        coding=[
                            Coding(
                                system="http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                                code=observation_data['interpretation'],
                                display=observation_data.get('interpretationDisplay')
                            )
                        ]
                    )
                ]

            # Build reference range
            reference_range = None
            if observation_data.get('referenceRange'):
                ref_range_data = observation_data['referenceRange']
                reference_range = [
                    ObservationReferenceRange(
                        low=Quantity(
                            value=ref_range_data.get('low'),
                            unit=ref_range_data.get('unit'),
                            system="http://unitsofmeasure.org"
                        ) if ref_range_data.get('low') is not None else None,
                        high=Quantity(
                            value=ref_range_data.get('high'),
                            unit=ref_range_data.get('unit'),
                            system="http://unitsofmeasure.org"
                        ) if ref_range_data.get('high') is not None else None,
                        text=ref_range_data.get('text')
                    )
                ]

            # Build note with confidence score if provided
            note = None
            note_text = observation_data.get('note', '')
            if observation_data.get('confidence'):
                confidence_pct = int(observation_data['confidence'] * 100)
                note_text = f"{note_text}\nExtracted from document. Confidence: {confidence_pct}%".strip()
            if observation_data.get('extractionDate'):
                note_text = f"{note_text}\nExtraction date: {observation_data['extractionDate']}".strip()

            if note_text:
                note = [Annotation(text=note_text)]

            # Build effective time (can be dateTime or Period)
            effective_date_time = observation_data.get('effectiveDateTime')
            effective_period = None
            if observation_data.get('effectivePeriod'):
                period_data = observation_data['effectivePeriod']
                effective_period = Period(
                    start=period_data.get('start'),
                    end=period_data.get('end')
                )

            # Build performer (who performed the observation)
            performer = None
            if observation_data.get('performer'):
                performer = [
                    Reference(reference=observation_data['performer'])
                ]

            # Create Observation resource
            observation = Observation(
                status=observation_data.get('status', 'final'),
                category=category,
                code=code,
                subject=Reference(reference=patient_reference),
                effectiveDateTime=effective_date_time,
                effectivePeriod=effective_period,
                valueQuantity=value_quantity,
                valueString=value_string,
                valueCodeableConcept=value_codeable_concept,
                valueBoolean=value_boolean,
                valueRange=value_range,
                interpretation=interpretation,
                referenceRange=reference_range,
                note=note,
                performer=performer
            )

            logger.info(f"Successfully created Observation resource")
            return observation

        except Exception as e:
            logger.error(f"Error creating Observation resource: {str(e)}")
            raise


    def create_encounter(
            self,
            encounter_data: Dict[str, Any],
            patient_reference: str
        ) -> Encounter:
            """
            Create a FHIR Encounter resource

            Args:
                encounter_data: Dictionary containing encounter information
                    {
                        "status": str (required: planned, arrived, triaged, in-progress, onleave, finished, cancelled),
                        "classCode": str (optional, default: AMB),
                        "classDisplay": str (optional, default: ambulatory),
                        "classSystem": str (optional),
                        "type": list[dict] (optional) - encounter type codes,
                        "serviceType": dict (optional) - service type,
                        "priority": dict (optional) - encounter priority,
                        "periodStart": str (optional, ISO format),
                        "periodEnd": str (optional, ISO format),
                        "reasonCode": list[dict] (optional) - reason for encounter,
                        "reasonReference": list[str] (optional) - references to conditions,
                        "diagnosis": list[dict] (optional) - diagnoses,
                        "participant": list[dict] (optional) - participants,
                        "location": list[dict] (optional) - locations,
                        "serviceProvider": str (optional) - organization reference,
                        "hospitalization": dict (optional) - hospitalization details,
                        "note": str (optional),
                        "confidence": float (optional),
                        "extractionDate": str (optional)
                    }
                patient_reference: Reference to Patient resource

            Returns:
                Encounter: FHIR Encounter resource
            """
            try:
                logger.info(f"Creating Encounter resource")

                # Build period
                period = None
                if encounter_data.get('periodStart'):
                    period = Period(
                        start=encounter_data['periodStart'],
                        end=encounter_data.get('periodEnd')
                    )

                # Build class (required)
                class_system = encounter_data.get('classSystem', "http://terminology.hl7.org/CodeSystem/v3-ActCode")
                class_code = encounter_data.get('classCode', 'AMB')
                class_display = encounter_data.get('classDisplay', 'ambulatory')

                class_fhir = [CodeableConcept(
                    coding=[Coding(
                        system=class_system,
                        code=class_code,
                        display=class_display
                    )]
                )]

                # Build type (optional)
                type_list = None
                if encounter_data.get('type'):
                    type_list = []
                    for type_data in encounter_data['type']:
                        codings = []
                        if type_data.get('code'):
                            codings.append(Coding(
                                system=type_data.get('system', "http://snomed.info/sct"),
                                code=type_data['code'],
                                display=type_data.get('display')
                            ))
                        type_list.append(CodeableConcept(
                            coding=codings,
                            text=type_data.get('text')
                        ))

                # Build service type (optional)
                service_type = None
                if encounter_data.get('serviceType'):
                    st_data = encounter_data['serviceType']
                    service_type = CodeableConcept(
                        coding=[Coding(
                            system=st_data.get('system', "http://terminology.hl7.org/CodeSystem/service-type"),
                            code=st_data.get('code'),
                            display=st_data.get('display')
                        )],
                        text=st_data.get('text')
                    )

                # Build priority (optional)
                priority = None
                if encounter_data.get('priority'):
                    p_data = encounter_data['priority']
                    priority = CodeableConcept(
                        coding=[Coding(
                            system=p_data.get('system', "http://terminology.hl7.org/CodeSystem/v3-ActPriority"),
                            code=p_data.get('code'),
                            display=p_data.get('display')
                        )],
                        text=p_data.get('text')
                    )

                # Build reason code (optional)
                reason_code = None
                if encounter_data.get('reasonCode'):
                    from fhir.resources.encounter import EncounterReason
                    from fhir.resources.codeablereference import CodeableReference
                    reason_code = []
                    for reason_data in encounter_data['reasonCode']:
                        codings = []
                        if reason_data.get('code'):
                            codings.append(Coding(
                                system=reason_data.get('system', "http://snomed.info/sct"),
                                code=reason_data['code'],
                                display=reason_data.get('display')
                            ))
                        reason_code.append(EncounterReason(
                            value=[CodeableReference(
                                concept=CodeableConcept(
                                    coding=codings,
                                    text=reason_data.get('text')
                                )
                            )]
                        ))

                # Build reason reference (optional)
                reason_reference = None
                if encounter_data.get('reasonReference'):
                    from fhir.resources.encounter import EncounterReason
                    from fhir.resources.codeablereference import CodeableReference
                    reason_reference = []
                    for ref in encounter_data['reasonReference']:
                        reason_reference.append(EncounterReason(
                            value=[CodeableReference(
                                reference=Reference(reference=ref)
                            )]
                        ))

                # Build diagnosis (optional)
                diagnosis = None
                if encounter_data.get('diagnosis'):
                    from fhir.resources.encounter import EncounterDiagnosis
                    from fhir.resources.codeablereference import CodeableReference
                    diagnosis = []
                    for diag_data in encounter_data['diagnosis']:
                        diag_condition = None
                        if diag_data.get('condition'):
                            diag_condition = [CodeableReference(
                                reference=Reference(reference=diag_data['condition'])
                            )]

                        diag_use = None
                        if diag_data.get('use'):
                            use_data = diag_data['use']
                            diag_use = [CodeableConcept(
                                coding=[Coding(
                                    system=use_data.get('system', "http://terminology.hl7.org/CodeSystem/diagnosis-role"),
                                    code=use_data.get('code'),
                                    display=use_data.get('display')
                                )],
                                text=use_data.get('text')
                            )]

                        diag_dict = {}
                        if diag_condition:
                            diag_dict['condition'] = diag_condition
                        if diag_use:
                            diag_dict['use'] = diag_use

                        diagnosis.append(EncounterDiagnosis(**diag_dict))

                # Build participant (optional)
                participant = None
                if encounter_data.get('participant'):
                    from fhir.resources.encounter import EncounterParticipant
                    participant = []
                    for part_data in encounter_data['participant']:
                        part_type = None
                        if part_data.get('type'):
                            part_type = []
                            for type_data in part_data['type']:
                                codings = []
                                if type_data.get('code'):
                                    codings.append(Coding(
                                        system=type_data.get('system', "http://terminology.hl7.org/CodeSystem/v3-ParticipationType"),
                                        code=type_data['code'],
                                        display=type_data.get('display')
                                    ))
                                part_type.append(CodeableConcept(
                                    coding=codings,
                                    text=type_data.get('text')
                                ))

                        part_period = None
                        if part_data.get('periodStart'):
                            part_period = Period(
                                start=part_data['periodStart'],
                                end=part_data.get('periodEnd')
                            )

                        participant.append(EncounterParticipant(
                            type=part_type,
                            period=part_period,
                            actor=Reference(reference=part_data['individual']) if part_data.get('individual') else None
                        ))

                # Build location (optional)
                location = None
                if encounter_data.get('location'):
                    from fhir.resources.encounter import EncounterLocation
                    location = []
                    for loc_data in encounter_data['location']:
                        loc_status = loc_data.get('status', 'active')
                        loc_period = None
                        if loc_data.get('periodStart'):
                            loc_period = Period(
                                start=loc_data['periodStart'],
                                end=loc_data.get('periodEnd')
                            )

                        location.append(EncounterLocation(
                            location=Reference(reference=loc_data['location']) if loc_data.get('location') else None,
                            status=loc_status,
                            period=loc_period
                        ))

                # Build hospitalization (optional)
                hospitalization = None
                if encounter_data.get('hospitalization'):
                    from fhir.resources.encounter import EncounterAdmission
                    hosp_data = encounter_data['hospitalization']

                    admit_source = None
                    if hosp_data.get('admitSource'):
                        as_data = hosp_data['admitSource']
                        admit_source = CodeableConcept(
                            coding=[Coding(
                                system=as_data.get('system', "http://terminology.hl7.org/CodeSystem/admit-source"),
                                code=as_data.get('code'),
                                display=as_data.get('display')
                            )],
                            text=as_data.get('text')
                        )

                    discharge_disposition = None
                    if hosp_data.get('dischargeDisposition'):
                        dd_data = hosp_data['dischargeDisposition']
                        discharge_disposition = CodeableConcept(
                            coding=[Coding(
                                system=dd_data.get('system', "http://terminology.hl7.org/CodeSystem/discharge-disposition"),
                                code=dd_data.get('code'),
                                display=dd_data.get('display')
                            )],
                            text=dd_data.get('text')
                        )

                    hosp_dict = {}
                    if admit_source:
                        hosp_dict['admitSource'] = admit_source
                    if discharge_disposition:
                        hosp_dict['dischargeDisposition'] = discharge_disposition

                    hospitalization = EncounterAdmission(**hosp_dict)

                # Build service provider (optional)
                service_provider = None
                if encounter_data.get('serviceProvider'):
                    service_provider = Reference(reference=encounter_data['serviceProvider'])

                # Build notes (optional) - Note: Encounter in FHIR R5 doesn't have a note field
                # Notes can be added via Communication or DocumentReference resources
                notes = None
                # Confidence and extraction metadata should be stored elsewhere or in extensions

                # Create Encounter resource - only include non-None fields
                encounter_data_dict = {
                    "status": encounter_data.get('status', 'finished'),
                    "class_fhir": class_fhir,
                    "subject": Reference(reference=patient_reference)
                }

                # Add optional fields only if they have values
                if type_list:
                    encounter_data_dict["type"] = type_list
                if service_type:
                    encounter_data_dict["serviceType"] = service_type
                if priority:
                    encounter_data_dict["priority"] = priority
                if period:
                    encounter_data_dict["actualPeriod"] = period

                # Combine reason_code and reason_reference into single reason field
                combined_reasons = []
                if reason_code:
                    combined_reasons.extend(reason_code)
                if reason_reference:
                    combined_reasons.extend(reason_reference)
                if combined_reasons:
                    encounter_data_dict["reason"] = combined_reasons

                if diagnosis:
                    encounter_data_dict["diagnosis"] = diagnosis
                if participant:
                    encounter_data_dict["participant"] = participant
                if location:
                    encounter_data_dict["location"] = location
                if hospitalization:
                    encounter_data_dict["admission"] = hospitalization
                if service_provider:
                    encounter_data_dict["serviceProvider"] = service_provider
                # Note: note field removed in FHIR R5

                encounter = Encounter(**encounter_data_dict)

                logger.info(f"Successfully created Encounter resource")
                return encounter

            except Exception as e:
                logger.error(f"Error creating Encounter resource: {str(e)}")
                raise

    def create_diagnostic_report(
        self,
        report_data: Dict[str, Any],
        patient_reference: str
    ) -> DiagnosticReport:
        """
        Create a FHIR DiagnosticReport resource

        Args:
            report_data: Dictionary containing diagnostic report information
                {
                    "text": str,  # Display text for the report
                    "code": str (optional),  # LOINC code
                    "display": str (optional),  # Display name for code
                    "codeSystem": str (optional),  # Code system URI (default: LOINC)
                    "status": str (default: "final"),  # registered | partial | preliminary | final
                    "category": str (optional),  # LAB | RAD | etc.
                    "categoryDisplay": str (optional),
                    "effectiveDateTime": str (optional),  # ISO datetime
                    "effectiveStart": str (optional),  # ISO datetime for period
                    "effectiveEnd": str (optional),  # ISO datetime for period
                    "issued": str (optional),  # When report was issued
                    "conclusion": str (optional),  # Clinical interpretation
                    "conclusionCode": str (optional),  # SNOMED CT code for conclusion
                    "conclusionCodeDisplay": str (optional),
                    "presentedForm": [  # Attached documents (optional)
                        {
                            "contentType": str,  # e.g., "application/pdf"
                            "url": str,  # S3 URL or data URL
                            "title": str (optional)
                        }
                    ],
                    "result": [str] (optional),  # References to Observation resources
                    "study": [str] (optional),  # References to ImagingStudy
                    "performer": [  # Who performed the test (optional)
                        {
                            "reference": str,  # e.g., "Practitioner/doc-123"
                            "display": str (optional)
                        }
                    ],
                    "resultsInterpreter": [  # Who interpreted results (optional)
                        {
                            "reference": str,
                            "display": str (optional)
                        }
                    ],
                    "specimen": [str] (optional),  # References to Specimen resources
                    "confidence": float (optional),  # 0-1 or 0-100
                    "extractionDate": str (optional),  # ISO date
                    "note": str (optional)
                }
            patient_reference: Reference to Patient resource (e.g., "Patient/patient-123")

        Returns:
            DiagnosticReport: FHIR DiagnosticReport resource
        """
        try:
            logger.info(f"Creating DiagnosticReport resource: {report_data.get('text', 'Unnamed Report')}")

            # Build code (required)
            code_codings = []
            if report_data.get('code'):
                code_codings.append(
                    Coding(
                        system=report_data.get('codeSystem', 'http://loinc.org'),
                        code=report_data['code'],
                        display=report_data.get('display')
                    )
                )

            code = CodeableConcept(
                coding=code_codings if code_codings else None,
                text=report_data.get('text')
            )

            # Build category (optional but recommended)
            category = None
            if report_data.get('category'):
                category = [CodeableConcept(
                    coding=[
                        Coding(
                            system="http://terminology.hl7.org/CodeSystem/v2-0074",
                            code=report_data['category'],
                            display=report_data.get('categoryDisplay', report_data['category'])
                        )
                    ]
                )]

            # Build effective time (when test was performed)
            effective_datetime = None
            effective_period = None
            if report_data.get('effectiveDateTime'):
                effective_datetime = report_data['effectiveDateTime']
            elif report_data.get('effectiveStart'):
                effective_period = Period(
                    start=report_data['effectiveStart'],
                    end=report_data.get('effectiveEnd')
                )

            # Build result references (links to Observation resources)
            result_refs = None
            if report_data.get('result'):
                result_refs = [
                    Reference(reference=ref) for ref in report_data['result']
                ]

            # Build imaging study references
            study_refs = None
            if report_data.get('study'):
                study_refs = [
                    Reference(reference=ref) for ref in report_data['study']
                ]

            # Build specimen references
            specimen_refs = None
            if report_data.get('specimen'):
                specimen_refs = [
                    Reference(reference=ref) for ref in report_data['specimen']
                ]

            # Build performer references
            performer_refs = None
            if report_data.get('performer'):
                performer_refs = [
                    Reference(
                        reference=perf['reference'],
                        display=perf.get('display')
                    ) for perf in report_data['performer']
                ]

            # Build results interpreter references
            interpreter_refs = None
            if report_data.get('resultsInterpreter'):
                interpreter_refs = [
                    Reference(
                        reference=interp['reference'],
                        display=interp.get('display')
                    ) for interp in report_data['resultsInterpreter']
                ]

            # Build conclusion codes
            conclusion_codes = None
            if report_data.get('conclusionCode'):
                conclusion_codes = [CodeableConcept(
                    coding=[
                        Coding(
                            system="http://snomed.info/sct",
                            code=report_data['conclusionCode'],
                            display=report_data.get('conclusionCodeDisplay')
                        )
                    ]
                )]

            # Build presented form (attached documents)
            presented_form = None
            if report_data.get('presentedForm'):
                from fhir.resources.attachment import Attachment
                presented_form = [
                    Attachment(
                        contentType=form.get('contentType', 'application/pdf'),
                        url=form.get('url'),
                        title=form.get('title')
                    ) for form in report_data['presentedForm']
                ]

            # Build notes with confidence score
            notes = []
            note_text = report_data.get('note', '')

            # Add confidence score to note if provided
            if report_data.get('confidence') is not None:
                confidence = report_data['confidence']
                # Normalize confidence to percentage if it's between 0-1
                if confidence <= 1.0:
                    confidence = confidence * 100

                confidence_text = f"Confidence: {confidence:.0f}%"

                if report_data.get('extractionDate'):
                    confidence_text = f"Extracted from document dated {report_data['extractionDate']}. {confidence_text}"

                if note_text:
                    note_text = f"{note_text}. {confidence_text}"
                else:
                    note_text = confidence_text

            if note_text:
                notes.append(Annotation(text=note_text))

            # Create DiagnosticReport resource
            diagnostic_report = DiagnosticReport(
                status=report_data.get('status', 'final'),
                code=code,
                subject=Reference(reference=patient_reference),
                category=category,
                effectiveDateTime=effective_datetime,
                effectivePeriod=effective_period,
                issued=report_data.get('issued'),
                performer=performer_refs,
                resultsInterpreter=interpreter_refs,
                specimen=specimen_refs,
                result=result_refs,
                study=study_refs,
                conclusion=report_data.get('conclusion'),
                conclusionCode=conclusion_codes,
                presentedForm=presented_form,
                note=notes if notes else None
            )

            logger.info(f"Successfully created DiagnosticReport resource")
            return diagnostic_report

        except Exception as e:
            logger.error(f"Error creating DiagnosticReport resource: {str(e)}")
            raise


    def create_bundle(
        self,
        resources: List[Any],
        bundle_type: str = "collection"
    ) -> Bundle:
        """
        Create a FHIR Bundle containing multiple resources

        Args:
            resources: List of FHIR resources
            bundle_type: Type of bundle (collection, transaction, etc.)

        Returns:
            Bundle: FHIR Bundle resource
        """
        try:
            logger.info(f"Creating Bundle with {len(resources)} resources")

            entries = []
            for resource in resources:
                entries.append(
                    BundleEntry(
                        resource=resource,
                        fullUrl=f"urn:uuid:{resource.id}" if hasattr(resource, 'id') and resource.id else None
                    )
                )

            bundle = Bundle(
                type=bundle_type,
                entry=entries if entries else None
            )

            logger.info(f"Successfully created Bundle")
            return bundle

        except Exception as e:
            logger.error(f"Error creating Bundle: {str(e)}")
            raise

    def resource_to_dict(self, resource: Any) -> Dict[str, Any]:
        """
        Convert FHIR resource to dictionary

        Args:
            resource: FHIR resource object

        Returns:
            Dictionary representation of the resource
        """
        try:
            return resource.model_dump(exclude_none=True)
        except Exception as e:
            logger.error(f"Error converting resource to dict: {str(e)}")
            raise

    def resource_to_json(self, resource: Any) -> str:
        """
        Convert FHIR resource to JSON string

        Args:
            resource: FHIR resource object

        Returns:
            JSON string representation of the resource
        """
        try:
            return resource.model_dump_json(exclude_none=True)
        except Exception as e:
            logger.error(f"Error converting resource to JSON: {str(e)}")
            raise
