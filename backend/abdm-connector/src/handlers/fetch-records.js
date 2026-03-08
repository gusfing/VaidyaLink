/**
 * ABDM Health Records Fetch Handler
 * Fetches health records from ABDM Health Information Exchange
 */

const { authenticate, checkPatientAccess } = require('../middleware/auth');

/**
 * Fetch health records from ABDM
 * Protected endpoint requiring patient authentication
 */
exports.handler = async (event) => {
  try {
    // Authenticate user
    const authResult = await authenticate(event);

    if (!authResult.authorized) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Unauthorized',
          message: authResult.error,
        }),
      };
    }

    // Check patient role
    const roleResult = checkPatientAccess(event);

    if (!roleResult.authorized) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Forbidden',
          message: roleResult.error,
        }),
      };
    }

    // Get authenticated user info
    const userId = event.user.sub;
    const username = event.user.username;

    console.log(`User ${username} (${userId}) fetching ABDM records`);

    // TODO: Get ABHA ID from DynamoDB
    // Table: ABHALinks
    // Query: PK: userId, SK: 'ABHA'

    // TODO: Check if user has linked ABHA ID
    const hasLinkedABHA = true; // Mock for now

    if (!hasLinkedABHA) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'No ABHA ID linked to this account',
        }),
      };
    }

    // TODO: Fetch health records from ABDM HIE
    // 1. Request consent from ABDM Consent Manager
    // POST https://abhasbx.abdm.gov.in/consent/v3/requests
    // 2. Wait for consent approval
    // 3. Fetch health information
    // GET https://abhasbx.abdm.gov.in/hi/v3/health-information/fetch

    // Mock FHIR bundle response
    const fhirBundle = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [
        {
          resource: {
            resourceType: 'Patient',
            id: 'patient-123',
            identifier: [
              {
                system: 'https://abdm.gov.in/abha',
                value: '12-3456-7890-1234',
              },
            ],
            name: [
              {
                text: 'Rajesh Kumar',
                family: 'Kumar',
                given: ['Rajesh'],
              },
            ],
            gender: 'male',
            birthDate: '1985-06-15',
          },
        },
        {
          resource: {
            resourceType: 'Observation',
            id: 'obs-456',
            status: 'final',
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '8867-4',
                  display: 'Heart rate',
                },
              ],
            },
            valueQuantity: {
              value: 72,
              unit: 'beats/minute',
              system: 'http://unitsofmeasure.org',
              code: '/min',
            },
            effectiveDateTime: '2024-01-15T10:30:00Z',
          },
        },
      ],
    };

    const response = {
      success: true,
      recordCount: fhirBundle.entry.length,
      fhirBundle,
      fetchedAt: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error fetching ABDM records:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: 'Failed to fetch ABDM records. Please try again.',
      }),
    };
  }
};
