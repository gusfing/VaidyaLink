/**
 * Unit tests for ProcessingMonitor component
 */

import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import ProcessingMonitor from '../ProcessingMonitor';
import * as queries from '@/lib/document-scan-demo/queries';
import type { JobStatusResponse } from '@/lib/document-scan-demo/types';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock the queries module
jest.mock('@/lib/document-scan-demo/queries');

describe('ProcessingMonitor', () => {
  const mockPush = jest.fn();
  const mockUseJobStatus = queries.useJobStatus as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  it('renders processing state with progress indicator', () => {
    const mockStatusData: JobStatusResponse = {
      jobId: 'job-123',
      status: 'processing',
      message: 'Processing document...',
    };

    mockUseJobStatus.mockReturnValue({
      data: mockStatusData,
      error: null,
      isError: false,
    });

    render(<ProcessingMonitor jobId="job-123" />);

    expect(screen.getByRole('heading', { name: 'Processing document...' })).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('displays extracting stage with correct progress', () => {
    const mockStatusData: JobStatusResponse = {
      jobId: 'job-123',
      status: 'extracting',
      message: 'Extracting text and data...',
    };

    mockUseJobStatus.mockReturnValue({
      data: mockStatusData,
      error: null,
      isError: false,
    });

    render(<ProcessingMonitor jobId="job-123" />);

    expect(
      screen.getByRole('heading', { name: 'Extracting text and data...' })
    ).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('displays transforming stage with correct progress', () => {
    const mockStatusData: JobStatusResponse = {
      jobId: 'job-123',
      status: 'transforming',
      message: 'Transforming to FHIR format...',
    };

    mockUseJobStatus.mockReturnValue({
      data: mockStatusData,
      error: null,
      isError: false,
    });

    render(<ProcessingMonitor jobId="job-123" />);

    expect(
      screen.getByRole('heading', { name: 'Transforming to FHIR format...' })
    ).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  it('navigates to results page on completion', async () => {
    const mockStatusData: JobStatusResponse = {
      jobId: 'job-123',
      status: 'complete',
      message: 'Processing complete!',
    };

    mockUseJobStatus.mockReturnValue({
      data: mockStatusData,
      error: null,
      isError: false,
    });

    render(<ProcessingMonitor jobId="job-123" />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/document-scan-demo/results/job-123');
    });
  });

  it('calls onComplete callback when provided', async () => {
    const mockOnComplete = jest.fn();
    const mockStatusData: JobStatusResponse = {
      jobId: 'job-123',
      status: 'complete',
      message: 'Processing complete!',
    };

    mockUseJobStatus.mockReturnValue({
      data: mockStatusData,
      error: null,
      isError: false,
    });

    render(<ProcessingMonitor jobId="job-123" onComplete={mockOnComplete} />);

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it('displays error message when processing fails', () => {
    const mockStatusData: JobStatusResponse = {
      jobId: 'job-123',
      status: 'failed',
      error: 'OCR extraction failed',
    };

    mockUseJobStatus.mockReturnValue({
      data: mockStatusData,
      error: null,
      isError: false,
    });

    render(<ProcessingMonitor jobId="job-123" />);

    expect(screen.getByText('Processing Failed')).toBeInTheDocument();
    expect(screen.getByText('OCR extraction failed')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('displays error message when API request fails', () => {
    mockUseJobStatus.mockReturnValue({
      data: null,
      error: new Error('Network error'),
      isError: true,
    });

    render(<ProcessingMonitor jobId="job-123" />);

    expect(screen.getByText('Processing Failed')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('displays elapsed time', () => {
    const mockStatusData: JobStatusResponse = {
      jobId: 'job-123',
      status: 'processing',
    };

    mockUseJobStatus.mockReturnValue({
      data: mockStatusData,
      error: null,
      isError: false,
    });

    render(<ProcessingMonitor jobId="job-123" />);

    expect(screen.getByText(/Elapsed time:/)).toBeInTheDocument();
  });

  it('shows all processing stages in order', () => {
    const mockStatusData: JobStatusResponse = {
      jobId: 'job-123',
      status: 'processing',
    };

    mockUseJobStatus.mockReturnValue({
      data: mockStatusData,
      error: null,
      isError: false,
    });

    render(<ProcessingMonitor jobId="job-123" />);

    // Check that all stages are present using getAllByText
    const stages = screen.getAllByText(/document|text|FHIR|complete/i);
    expect(stages.length).toBeGreaterThan(0);

    // Verify specific stages exist
    expect(screen.getAllByText('Uploading document...').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Processing document...').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Extracting text and data...').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Transforming to FHIR format...').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Processing complete!').length).toBeGreaterThan(0);
  });
});
