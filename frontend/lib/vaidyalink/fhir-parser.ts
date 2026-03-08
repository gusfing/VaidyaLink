/**
 * FHIR Resource Parser and Pretty Printer
 *
 * Implements parsing and formatting for HL7 FHIR R4 resources.
 * Supports: Patient, Observation, MedicationRequest, DiagnosticReport
 *
 * Requirements: 12.1, 12.2, 12.3, 12.5, 12.6
 */

/**
 * Error class for FHIR parsing errors
 */
export class FHIRParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FHIRParseError';
  }
}

/**
 * Validation error with field information
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Base FHIR Resource interface
 */
export interface FHIRResource {
  resourceType: string;
  id: string;
  [key: string]: unknown;
}

/**
 * FHIR Patient Resource (HL7 FHIR R4)
 */
export interface FHIRPatient extends FHIRResource {
  resourceType: 'Patient';
  id: string;
  name: Array<{
    use?: string;
    family?: string;
    given?: string[];
    text?: string;
  }>;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  address?: Array<{
    use?: string;
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
  telecom?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
}

/**
 * FHIR Observation Resource (HL7 FHIR R4)
 */
export interface FHIRObservation extends FHIRResource {
  resourceType: 'Observation';
  id: string;
  status:
    | 'registered'
    | 'preliminary'
    | 'final'
    | 'amended'
    | 'corrected'
    | 'cancelled'
    | 'entered-in-error'
    | 'unknown';
  code: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  subject: {
    reference?: string;
    display?: string;
  };
  valueQuantity?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  effectiveDateTime?: string;
  performer?: Array<{
    reference?: string;
    display?: string;
  }>;
}

/**
 * FHIR MedicationRequest Resource (HL7 FHIR R4)
 */
export interface FHIRMedicationRequest extends FHIRResource {
  resourceType: 'MedicationRequest';
  id: string;
  status:
    | 'active'
    | 'on-hold'
    | 'cancelled'
    | 'completed'
    | 'entered-in-error'
    | 'stopped'
    | 'draft'
    | 'unknown';
  intent:
    | 'proposal'
    | 'plan'
    | 'order'
    | 'original-order'
    | 'reflex-order'
    | 'filler-order'
    | 'instance-order'
    | 'option';
  medicationCodeableConcept?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  medicationReference?: {
    reference?: string;
    display?: string;
  };
  subject: {
    reference?: string;
    display?: string;
  };
  dosageInstruction?: Array<{
    text?: string;
    timing?: object;
    route?: object;
    doseAndRate?: Array<{
      doseQuantity?: {
        value?: number;
        unit?: string;
      };
    }>;
  }>;
  authoredOn?: string;
  requester?: {
    reference?: string;
    display?: string;
  };
}

/**
 * FHIR DiagnosticReport Resource (HL7 FHIR R4)
 */
export interface FHIRDiagnosticReport extends FHIRResource {
  resourceType: 'DiagnosticReport';
  id: string;
  status:
    | 'registered'
    | 'partial'
    | 'preliminary'
    | 'final'
    | 'amended'
    | 'corrected'
    | 'appended'
    | 'cancelled'
    | 'entered-in-error'
    | 'unknown';
  code: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  subject: {
    reference?: string;
    display?: string;
  };
  result?: Array<{
    reference?: string;
    display?: string;
  }>;
  effectiveDateTime?: string;
  issued?: string;
}

/**
 * Union type for all supported FHIR resources
 */
export type SupportedFHIRResource =
  | FHIRPatient
  | FHIRObservation
  | FHIRMedicationRequest
  | FHIRDiagnosticReport;

/**
 * Validate Patient resource
 */
function validatePatient(resource: FHIRResource): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!resource.name || !Array.isArray(resource.name) || resource.name.length === 0) {
    errors.push({ field: 'name', message: 'Patient must have at least one name' });
  }

  if (
    resource.gender &&
    !['male', 'female', 'other', 'unknown'].includes(resource.gender as string)
  ) {
    errors.push({ field: 'gender', message: 'Invalid gender value' });
  }

  return errors;
}

/**
 * Validate Observation resource
 */
function validateObservation(resource: FHIRResource): ValidationError[] {
  const errors: ValidationError[] = [];

  const validStatuses = [
    'registered',
    'preliminary',
    'final',
    'amended',
    'corrected',
    'cancelled',
    'entered-in-error',
    'unknown',
  ];
  if (!resource.status || !validStatuses.includes(resource.status as string)) {
    errors.push({ field: 'status', message: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  if (!resource.code || typeof resource.code !== 'object') {
    errors.push({ field: 'code', message: 'Observation must have a code' });
  }

  if (!resource.subject || typeof resource.subject !== 'object') {
    errors.push({ field: 'subject', message: 'Observation must have a subject' });
  }

  return errors;
}

/**
 * Validate MedicationRequest resource
 */
function validateMedicationRequest(resource: FHIRResource): ValidationError[] {
  const errors: ValidationError[] = [];

  const validStatuses = [
    'active',
    'on-hold',
    'cancelled',
    'completed',
    'entered-in-error',
    'stopped',
    'draft',
    'unknown',
  ];
  if (!resource.status || !validStatuses.includes(resource.status as string)) {
    errors.push({ field: 'status', message: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  const validIntents = [
    'proposal',
    'plan',
    'order',
    'original-order',
    'reflex-order',
    'filler-order',
    'instance-order',
    'option',
  ];
  if (!resource.intent || !validIntents.includes(resource.intent as string)) {
    errors.push({ field: 'intent', message: `Intent must be one of: ${validIntents.join(', ')}` });
  }

  if (!resource.medicationCodeableConcept && !resource.medicationReference) {
    errors.push({
      field: 'medication[x]',
      message:
        'MedicationRequest must have either medicationCodeableConcept or medicationReference',
    });
  }

  if (!resource.subject || typeof resource.subject !== 'object') {
    errors.push({ field: 'subject', message: 'MedicationRequest must have a subject' });
  }

  return errors;
}

/**
 * Validate DiagnosticReport resource
 */
function validateDiagnosticReport(resource: FHIRResource): ValidationError[] {
  const errors: ValidationError[] = [];

  const validStatuses = [
    'registered',
    'partial',
    'preliminary',
    'final',
    'amended',
    'corrected',
    'appended',
    'cancelled',
    'entered-in-error',
    'unknown',
  ];
  if (!resource.status || !validStatuses.includes(resource.status as string)) {
    errors.push({ field: 'status', message: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  if (!resource.code || typeof resource.code !== 'object') {
    errors.push({ field: 'code', message: 'DiagnosticReport must have a code' });
  }

  if (!resource.subject || typeof resource.subject !== 'object') {
    errors.push({ field: 'subject', message: 'DiagnosticReport must have a subject' });
  }

  return errors;
}

/**
 * Parse FHIR resource JSON into typed resource objects
 *
 * @param json - FHIR resource as JSON string or object
 * @returns Parsed FHIR resource object
 * @throws FHIRParseError with validation errors if the resource is invalid
 */
export function parseFHIRResource(json: string | object): SupportedFHIRResource {
  let resource: FHIRResource;

  // Parse JSON if string
  try {
    resource = typeof json === 'string' ? JSON.parse(json) : (json as FHIRResource);
  } catch (error) {
    throw new FHIRParseError('Invalid JSON: ' + (error as Error).message);
  }

  // Validate basic structure
  if (!resource || typeof resource !== 'object') {
    throw new FHIRParseError('Resource must be an object');
  }

  // Validate resourceType field
  if (!resource.resourceType || typeof resource.resourceType !== 'string') {
    throw new FHIRParseError('Missing or invalid resourceType field');
  }

  // Validate id field
  if (!resource.id || typeof resource.id !== 'string') {
    throw new FHIRParseError('Missing or invalid id field');
  }

  // Validate supported resource types
  const supportedTypes = ['Patient', 'Observation', 'MedicationRequest', 'DiagnosticReport'];
  if (!supportedTypes.includes(resource.resourceType)) {
    throw new FHIRParseError(
      `Unsupported resourceType: ${resource.resourceType}. Supported types: ${supportedTypes.join(', ')}`
    );
  }

  // Validate resource-specific fields
  let validationErrors: ValidationError[] = [];

  switch (resource.resourceType) {
    case 'Patient':
      validationErrors = validatePatient(resource);
      break;
    case 'Observation':
      validationErrors = validateObservation(resource);
      break;
    case 'MedicationRequest':
      validationErrors = validateMedicationRequest(resource);
      break;
    case 'DiagnosticReport':
      validationErrors = validateDiagnosticReport(resource);
      break;
  }

  // Throw error if validation failed
  if (validationErrors.length > 0) {
    const errorMessages = validationErrors.map((e) => `${e.field}: ${e.message}`).join('; ');
    throw new FHIRParseError(`Validation errors: ${errorMessages}`);
  }

  return resource as SupportedFHIRResource;
}

/**
 * Format FHIR resource object back into valid FHIR JSON
 *
 * Follows HL7 FHIR R4 specification formatting rules:
 * - 2-space indentation
 * - Alphabetically sorted keys (except resourceType and id which come first)
 * - No trailing commas
 * - Proper JSON escaping
 *
 * @param resource - FHIR resource object to format
 * @returns Formatted FHIR JSON string
 * @throws FHIRParseError if the resource is invalid
 */
export function printFHIRResource(resource: SupportedFHIRResource): string {
  // Validate input
  if (!resource || typeof resource !== 'object') {
    throw new FHIRParseError('Resource must be an object');
  }

  if (!resource.resourceType || typeof resource.resourceType !== 'string') {
    throw new FHIRParseError('Missing or invalid resourceType field');
  }

  if (!resource.id || typeof resource.id !== 'string') {
    throw new FHIRParseError('Missing or invalid id field');
  }

  // Sort keys with resourceType and id first, then alphabetically
  const sortedResource: Record<string, unknown> = {};

  // Add resourceType and id first
  sortedResource.resourceType = resource.resourceType;
  sortedResource.id = resource.id;

  // Add remaining keys alphabetically
  const remainingKeys = Object.keys(resource)
    .filter((key) => key !== 'resourceType' && key !== 'id')
    .sort();

  for (const key of remainingKeys) {
    sortedResource[key] = resource[key];
  }

  // Format as JSON with 2-space indentation
  return JSON.stringify(sortedResource, null, 2);
}
