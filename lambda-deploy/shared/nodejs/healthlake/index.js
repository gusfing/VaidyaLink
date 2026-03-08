/**
 * AWS HealthLake Client Helper
 *
 * Provides a simplified interface for interacting with AWS HealthLake FHIR datastores.
 * Handles authentication, error handling, and common FHIR operations.
 */

const {
  HealthLakeClient: AWSHealthLakeClient,
  CreateResourceCommand,
  ReadResourceCommand,
  UpdateResourceCommand,
  DeleteResourceCommand,
  SearchWithGetCommand,
} = require('@aws-sdk/client-healthlake');

class HealthLakeClient {
  /**
   * Initialize HealthLake client.
   *
   * @param {Object} options - Configuration options
   * @param {string} options.datastoreId - HealthLake datastore ID (defaults to env var)
   * @param {string} options.datastoreEndpoint - HealthLake endpoint URL (defaults to env var)
   * @param {string} options.region - AWS region (defaults to env var or us-east-1)
   */
  constructor(options = {}) {
    this.datastoreId = options.datastoreId || process.env.HEALTHLAKE_DATASTORE_ID;
    this.datastoreEndpoint = options.datastoreEndpoint || process.env.HEALTHLAKE_DATASTORE_ENDPOINT;
    this.region = options.region || process.env.AWS_REGION || 'us-east-1';

    if (!this.datastoreId) {
      throw new Error('HEALTHLAKE_DATASTORE_ID must be provided or set as environment variable');
    }

    if (!this.datastoreEndpoint) {
      throw new Error(
        'HEALTHLAKE_DATASTORE_ENDPOINT must be provided or set as environment variable'
      );
    }

    // Initialize AWS SDK client
    this.client = new AWSHealthLakeClient({ region: this.region });
  }

  /**
   * Create a FHIR resource in HealthLake.
   *
   * @param {string} resourceType - FHIR resource type (e.g., 'Patient', 'Observation')
   * @param {Object} resourceData - FHIR resource data
   * @returns {Promise<Object>} Created resource with ID and metadata
   */
  async createResource(resourceType, resourceData) {
    try {
      // Ensure resourceType is set
      resourceData.resourceType = resourceType;

      const command = new CreateResourceCommand({
        DatastoreId: this.datastoreId,
        Resource: JSON.stringify(resourceData),
      });

      const response = await this.client.send(command);
      return JSON.parse(response.Resource);
    } catch (error) {
      throw new Error(`Failed to create ${resourceType}: ${error.message}`);
    }
  }

  /**
   * Read a FHIR resource from HealthLake by ID.
   *
   * @param {string} resourceType - FHIR resource type (e.g., 'Patient', 'Observation')
   * @param {string} resourceId - FHIR resource ID
   * @returns {Promise<Object>} FHIR resource data
   */
  async readResource(resourceType, resourceId) {
    try {
      const command = new ReadResourceCommand({
        DatastoreId: this.datastoreId,
        ResourceType: resourceType,
        ResourceId: resourceId,
      });

      const response = await this.client.send(command);
      return JSON.parse(response.Resource);
    } catch (error) {
      throw new Error(`Failed to read ${resourceType}/${resourceId}: ${error.message}`);
    }
  }

  /**
   * Update a FHIR resource in HealthLake.
   *
   * @param {string} resourceType - FHIR resource type
   * @param {string} resourceId - FHIR resource ID
   * @param {Object} resourceData - Updated FHIR resource data
   * @returns {Promise<Object>} Updated resource with new version metadata
   */
  async updateResource(resourceType, resourceId, resourceData) {
    try {
      // Ensure resourceType and id are set
      resourceData.resourceType = resourceType;
      resourceData.id = resourceId;

      const command = new UpdateResourceCommand({
        DatastoreId: this.datastoreId,
        Resource: JSON.stringify(resourceData),
      });

      const response = await this.client.send(command);
      return JSON.parse(response.Resource);
    } catch (error) {
      throw new Error(`Failed to update ${resourceType}/${resourceId}: ${error.message}`);
    }
  }

  /**
   * Delete a FHIR resource from HealthLake.
   *
   * @param {string} resourceType - FHIR resource type
   * @param {string} resourceId - FHIR resource ID
   * @returns {Promise<void>}
   */
  async deleteResource(resourceType, resourceId) {
    try {
      const command = new DeleteResourceCommand({
        DatastoreId: this.datastoreId,
        ResourceType: resourceType,
        ResourceId: resourceId,
      });

      await this.client.send(command);
    } catch (error) {
      throw new Error(`Failed to delete ${resourceType}/${resourceId}: ${error.message}`);
    }
  }

  /**
   * Search for FHIR resources using search parameters.
   *
   * @param {string} resourceType - FHIR resource type to search
   * @param {Object} searchParams - Dictionary of FHIR search parameters
   * @returns {Promise<Array>} List of matching FHIR resources
   */
  async searchResources(resourceType, searchParams = {}) {
    try {
      // Build query string from search params
      const queryParts = Object.entries(searchParams).map(([key, value]) => `${key}=${value}`);
      const queryString = queryParts.join('&');

      const command = new SearchWithGetCommand({
        DatastoreId: this.datastoreId,
        ResourceType: resourceType,
        QueryString: queryString,
      });

      const response = await this.client.send(command);
      const bundle = JSON.parse(response.Resource);

      // Extract resources from bundle
      const resources = [];
      if (bundle.entry) {
        resources.push(...bundle.entry.map((entry) => entry.resource));
      }

      return resources;
    } catch (error) {
      throw new Error(`Failed to search ${resourceType}: ${error.message}`);
    }
  }

  /**
   * Get all resources for a specific patient.
   *
   * @param {string} patientId - FHIR Patient resource ID
   * @returns {Promise<Object>} Dictionary mapping resource types to lists of resources
   */
  async getPatientResources(patientId) {
    const resourceTypes = [
      'Observation',
      'Condition',
      'MedicationStatement',
      'Procedure',
      'DiagnosticReport',
      'Encounter',
      'AllergyIntolerance',
    ];

    const patientResources = {};

    for (const resourceType of resourceTypes) {
      try {
        const resources = await this.searchResources(resourceType, { patient: patientId });
        patientResources[resourceType] = resources;
      } catch (error) {
        // Log error but continue with other resource types
        console.warn(
          `Warning: Failed to fetch ${resourceType} for patient ${patientId}: ${error.message}`
        );
        patientResources[resourceType] = [];
      }
    }

    return patientResources;
  }

  /**
   * Create a FHIR Bundle resource.
   *
   * @param {Array} resources - List of FHIR resources to include in bundle
   * @param {string} bundleType - Bundle type ('transaction', 'batch', 'collection', etc.)
   * @returns {Object} FHIR Bundle resource
   */
  createBundle(resources, bundleType = 'transaction') {
    const entries = resources.map((resource) => {
      const entry = { resource };

      // Add request for transaction/batch bundles
      if (bundleType === 'transaction' || bundleType === 'batch') {
        const resourceType = resource.resourceType;
        const resourceId = resource.id;

        if (resourceId) {
          entry.request = {
            method: 'PUT',
            url: `${resourceType}/${resourceId}`,
          };
        } else {
          entry.request = {
            method: 'POST',
            url: resourceType,
          };
        }
      }

      return entry;
    });

    return {
      resourceType: 'Bundle',
      type: bundleType,
      entry: entries,
    };
  }
}

module.exports = { HealthLakeClient };
