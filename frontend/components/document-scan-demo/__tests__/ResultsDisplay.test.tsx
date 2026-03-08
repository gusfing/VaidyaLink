/**
 * Unit tests for ResultsDisplay component
 */

import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import ResultsDisplay from '../ResultsDisplay';
import * as queries from '@/lib/document-scan-demo/queries';
import type { ProcessingResults } from '@/lib/document-scan-demo/types';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock the queries module
jest.mock('@/lib/document-scan-demo/queries', () => ({
  useProcessingResults: jest.fn(),
}));

// Mock react-syntax-highlighter
jest.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: { children: string }) => <pre>{children}</pre>,
}));

jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  vscDarkPlus: {},
}));

describe('ResultsDisplay', () => {
  let queryClient: QueryClient;
  let mockRouter: { push: jest.Mock };

  const mockResults: ProcessingResults = {
    jobId: 'test-job-123',
    documentUrl: 'https://example.com/document.jpg',
    ocrText: 'Patient Name: John Doe\nMedication: Amoxicillin 500mg',
    entities: [
      { text: 'Amoxicillin', type: 'MEDICATION', confidence: 0.95 },
      { text: 'Bacterial Infection', type: 'CONDITION', confidence: 0.88 },
    ],
    medications: [
      {
        name: 'Amoxicillin',
        dosage: '500mg',
        frequency: '3 times daily',
        confidence: 0.95,
      },
    ],
    conditions: ['Bacterial Infection'],
    labResults: [
      {
        testName: 'Hemoglobin',
        value: '14.2',
        unit: 'g/dL',
        confidence: 0.92,
      },
    ],
    fhirResource: {
      resourceType: 'MedicationRequest',
      status: 'active',
    },
    processedAt: '2024-01-15T10:30:00Z',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    mockRouter = {
      push: jest.fn(),
    };

    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = (jobId: string = 'test-job-123') => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ResultsDisplay jobId={jobId} />
      </QueryClientProvider>
    );
  };

  describe('Loading State', () => {
    it('should display loading indicator while fetching results', () => {
      (queries.useProcessingResults as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        isError: false,
      });

      renderComponent();

      expect(screen.getByText('Loading results...')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when results fetch fails', () => {
      (queries.useProcessingResults as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
        isError: true,
      });

      renderComponent();

      expect(screen.getByText('Error Loading Results')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('should display generic error when no results and no error message', () => {
      (queries.useProcessingResults as jest.Mock).mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
        isError: false,
      });

      renderComponent();

      expect(screen.getByText('Failed to load results')).toBeInTheDocument();
    });

    it('should navigate to upload page when New Scan button clicked in error state', () => {
      (queries.useProcessingResults as jest.Mock).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
        isError: true,
      });

      renderComponent();

      const newScanButton = screen.getByRole('button', { name: /new scan/i });
      newScanButton.click();

      expect(mockRouter.push).toHaveBeenCalledWith('/document-scan-demo');
    });
  });

  describe('Results Display', () => {
    beforeEach(() => {
      (queries.useProcessingResults as jest.Mock).mockReturnValue({
        data: mockResults,
        isLoading: false,
        error: null,
        isError: false,
      });
    });

    it('should display header with title and processed date', () => {
      renderComponent();

      expect(screen.getByText('Processing Results')).toBeInTheDocument();
      expect(screen.getByText(/Processed at/)).toBeInTheDocument();
    });

    it('should display New Scan button in header', () => {
      renderComponent();

      const newScanButton = screen.getByRole('button', { name: /new scan/i });
      expect(newScanButton).toBeInTheDocument();
    });

    it('should navigate to upload page when New Scan button clicked', () => {
      renderComponent();

      const newScanButton = screen.getByRole('button', { name: /new scan/i });
      newScanButton.click();

      expect(mockRouter.push).toHaveBeenCalledWith('/document-scan-demo');
    });

    it('should display original document image', () => {
      renderComponent();

      expect(screen.getByText('Original Document')).toBeInTheDocument();
      const image = screen.getByAltText('Original document');
      expect(image).toHaveAttribute('src', mockResults.documentUrl);
    });

    it('should display all four tabs', () => {
      renderComponent();

      expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'OCR' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Structured' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'FHIR' })).toBeInTheDocument();
    });

    it('should display Overview tab by default', () => {
      renderComponent();

      expect(screen.getByText('Summary')).toBeInTheDocument();
      expect(screen.getByText('Medications')).toBeInTheDocument();
      expect(screen.getByText('Conditions')).toBeInTheDocument();
      expect(screen.getByText('Lab Results')).toBeInTheDocument();
    });
  });

  describe('Overview Tab', () => {
    beforeEach(() => {
      (queries.useProcessingResults as jest.Mock).mockReturnValue({
        data: mockResults,
        isLoading: false,
        error: null,
        isError: false,
      });
    });

    it('should display summary counts', () => {
      renderComponent();

      // Check for counts
      expect(screen.getByText('1')).toBeInTheDocument(); // Medications count
      expect(screen.getByText('1')).toBeInTheDocument(); // Conditions count
      expect(screen.getByText('1')).toBeInTheDocument(); // Lab Results count
    });

    it('should display key entities with confidence scores', () => {
      renderComponent();

      expect(screen.getByText('Key Entities')).toBeInTheDocument();
      expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
      expect(screen.getByText('95%')).toBeInTheDocument();
    });

    it('should display medications preview', () => {
      renderComponent();

      expect(screen.getByText('Medications Preview')).toBeInTheDocument();
      expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
      expect(screen.getByText('500mg • 3 times daily')).toBeInTheDocument();
    });
  });

  describe('OCR Tab', () => {
    beforeEach(() => {
      (queries.useProcessingResults as jest.Mock).mockReturnValue({
        data: mockResults,
        isLoading: false,
        error: null,
        isError: false,
      });
    });

    it('should display OCR text when OCR tab is clicked', () => {
      renderComponent();

      const ocrTab = screen.getByRole('button', { name: 'OCR' });
      ocrTab.click();

      expect(screen.getByText('Extracted Text')).toBeInTheDocument();
      expect(screen.getByText(/Patient Name: John Doe/)).toBeInTheDocument();
    });
  });

  describe('Structured Tab', () => {
    beforeEach(() => {
      (queries.useProcessingResults as jest.Mock).mockReturnValue({
        data: mockResults,
        isLoading: false,
        error: null,
        isError: false,
      });
    });

    it('should display medications with all required fields', () => {
      renderComponent();

      const structuredTab = screen.getByRole('button', { name: 'Structured' });
      structuredTab.click();

      expect(screen.getByText('Medications')).toBeInTheDocument();
      expect(screen.getByText('Amoxicillin')).toBeInTheDocument();
      expect(screen.getByText(/Dosage:/)).toBeInTheDocument();
      expect(screen.getByText(/500mg/)).toBeInTheDocument();
      expect(screen.getByText(/Frequency:/)).toBeInTheDocument();
      expect(screen.getByText(/3 times daily/)).toBeInTheDocument();
    });

    it('should display medication confidence scores', () => {
      renderComponent();

      const structuredTab = screen.getByRole('button', { name: 'Structured' });
      structuredTab.click();

      expect(screen.getByText('95%')).toBeInTheDocument();
    });

    it('should display conditions', () => {
      renderComponent();

      const structuredTab = screen.getByRole('button', { name: 'Structured' });
      structuredTab.click();

      expect(screen.getByText('Conditions')).toBeInTheDocument();
      expect(screen.getByText('Bacterial Infection')).toBeInTheDocument();
    });

    it('should display lab results with all required fields', () => {
      renderComponent();

      const structuredTab = screen.getByRole('button', { name: 'Structured' });
      structuredTab.click();

      expect(screen.getByText('Lab Results')).toBeInTheDocument();
      expect(screen.getByText('Hemoglobin')).toBeInTheDocument();
      expect(screen.getByText('14.2')).toBeInTheDocument();
      expect(screen.getByText('g/dL')).toBeInTheDocument();
      expect(screen.getByText('92%')).toBeInTheDocument();
    });

    it('should display lab results in a table format', () => {
      renderComponent();

      const structuredTab = screen.getByRole('button', { name: 'Structured' });
      structuredTab.click();

      // Check for table headers
      expect(screen.getByText('Test Name')).toBeInTheDocument();
      expect(screen.getByText('Value')).toBeInTheDocument();
      expect(screen.getByText('Unit')).toBeInTheDocument();
      expect(screen.getByText('Confidence')).toBeInTheDocument();
    });
  });

  describe('FHIR Tab', () => {
    beforeEach(() => {
      (queries.useProcessingResults as jest.Mock).mockReturnValue({
        data: mockResults,
        isLoading: false,
        error: null,
        isError: false,
      });
    });

    it('should display FHIR resource when FHIR tab is clicked', () => {
      renderComponent();

      const fhirTab = screen.getByRole('button', { name: 'FHIR' });
      fhirTab.click();

      expect(screen.getByText('FHIR Resource')).toBeInTheDocument();
    });
  });

  describe('Confidence Score Colors', () => {
    it('should use green color for confidence > 90%', () => {
      const resultsWithHighConfidence: ProcessingResults = {
        ...mockResults,
        medications: [
          {
            name: 'Test Med',
            dosage: '100mg',
            frequency: 'daily',
            confidence: 0.95,
          },
        ],
      };

      (queries.useProcessingResults as jest.Mock).mockReturnValue({
        data: resultsWithHighConfidence,
        isLoading: false,
        error: null,
        isError: false,
      });

      renderComponent();

      const structuredTab = screen.getByRole('button', { name: 'Structured' });
      structuredTab.click();

      const badge = screen.getByText('95%');
      expect(badge).toHaveClass('bg-green-100', 'text-green-800');
    });

    it('should use yellow color for confidence 70-90%', () => {
      const resultsWithMediumConfidence: ProcessingResults = {
        ...mockResults,
        medications: [
          {
            name: 'Test Med',
            dosage: '100mg',
            frequency: 'daily',
            confidence: 0.8,
          },
        ],
      };

      (queries.useProcessingResults as jest.Mock).mockReturnValue({
        data: resultsWithMediumConfidence,
        isLoading: false,
        error: null,
        isError: false,
      });

      renderComponent();

      const structuredTab = screen.getByRole('button', { name: 'Structured' });
      structuredTab.click();

      const badge = screen.getByText('80%');
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });

    it('should use red color for confidence < 70%', () => {
      const resultsWithLowConfidence: ProcessingResults = {
        ...mockResults,
        medications: [
          {
            name: 'Test Med',
            dosage: '100mg',
            frequency: 'daily',
            confidence: 0.6,
          },
        ],
      };

      (queries.useProcessingResults as jest.Mock).mockReturnValue({
        data: resultsWithLowConfidence,
        isLoading: false,
        error: null,
        isError: false,
      });

      renderComponent();

      const structuredTab = screen.getByRole('button', { name: 'Structured' });
      structuredTab.click();

      const badge = screen.getByText('60%');
      expect(badge).toHaveClass('bg-red-100', 'text-red-800');
    });
  });
});
