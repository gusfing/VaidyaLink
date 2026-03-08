"""
Clinical Summarizer Utilities

This package contains utility modules for the Clinical Summarizer Lambda.
"""

from .data_aggregator import (
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

__all__ = [
    'aggregate_clinical_data',
    'extract_patient_demographics',
    'extract_conditions',
    'extract_medications',
    'extract_encounters',
    'extract_observations',
    'extract_allergies',
    'extract_diagnostic_reports',
    'extract_procedures',
    'identify_critical_information',
    'create_chronological_timeline',
    'DataAggregationError'
]
