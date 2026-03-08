/**
 * Unit tests for UploadInterface component
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UploadInterface from '../UploadInterface';
import { ToastProvider } from '../ToastContainer';
import * as apiClient from '@/lib/document-scan-demo/api-client';
import axios from 'axios';

// Mock axios before importing anything else
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
  put: jest.fn(),
  isAxiosError: jest.fn((error) => error && error.isAxiosError === true),
}));

// Mock axios-retry
jest.mock('axios-retry', () => jest.fn());

// Mock aws-amplify auth
jest.mock('aws-amplify/auth', () => ({
  fetchAuthSession: jest.fn(),
}));

// Mock the API client
jest.mock('@/lib/document-scan-demo/api-client');

describe('UploadInterface', () => {
  const mockOnUploadComplete = jest.fn();

  // Helper function to render with ToastProvider
  const renderWithToast = (component: React.ReactElement) => {
    return render(<ToastProvider>{component}</ToastProvider>);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dropzone with instructions', () => {
    renderWithToast(<UploadInterface onUploadComplete={mockOnUploadComplete} />);

    expect(screen.getByText(/Drag and drop a medical document/i)).toBeInTheDocument();
    expect(screen.getByText(/or click to browse/i)).toBeInTheDocument();
    expect(screen.getByText(/PNG, JPG, JPEG, or PDF \(max 10MB\)/i)).toBeInTheDocument();
  });

  it('accepts PDF files and displays PDF icon', async () => {
    renderWithToast(<UploadInterface onUploadComplete={mockOnUploadComplete} />);

    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const input = screen
      .getByRole('presentation')
      .querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    // Verify PDF icon is shown
    await waitFor(() => {
      expect(screen.getByText('PDF Document')).toBeInTheDocument();
      expect(screen.getByText('Upload & Process')).toBeInTheDocument();
    });
  });

  it('displays error for unsupported file type', async () => {
    renderWithToast(<UploadInterface onUploadComplete={mockOnUploadComplete} />);

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const input = screen
      .getByRole('presentation')
      .querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      const errorMessages = screen.getAllByText(
        /Unsupported file format. Please upload JPEG, PNG, or PDF/i
      );
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  it('displays error for oversized file', async () => {
    renderWithToast(<UploadInterface onUploadComplete={mockOnUploadComplete} />);

    // Create a file larger than 10MB
    const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
    const input = screen
      .getByRole('presentation')
      .querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [largeFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      const errorMessages = screen.getAllByText(/File too large. Maximum size is 10MB/i);
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });

  it('accepts valid image files', async () => {
    // Mock FileReader
    const mockReadAsDataURL = jest.fn();
    const mockFileReader: any = {
      readAsDataURL: mockReadAsDataURL,
      result: 'data:image/jpeg;base64,test',
    };

    global.FileReader = jest.fn(() => mockFileReader) as any;

    renderWithToast(<UploadInterface onUploadComplete={mockOnUploadComplete} />);

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen
      .getByRole('presentation')
      .querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    // Wait for FileReader to be called
    await waitFor(() => {
      expect(mockReadAsDataURL).toHaveBeenCalledWith(file);
    });

    // Simulate FileReader completion
    mockFileReader.onloadend?.();

    // Verify preview is shown
    await waitFor(() => {
      const preview = screen.queryByAltText('Document preview');
      expect(preview).toBeInTheDocument();
    });
  });

  it('handles successful upload workflow', async () => {
    const mockGetPresignedUrl = apiClient.getPresignedUrl as jest.Mock;
    const mockTriggerProcessing = apiClient.triggerProcessing as jest.Mock;
    const mockAxiosPut = axios.put as jest.Mock;

    mockGetPresignedUrl.mockResolvedValue({
      uploadUrl: 'https://s3.amazonaws.com/test',
      s3Key: 'uploads/test.jpg',
      expiresIn: 3600,
    });

    mockAxiosPut.mockResolvedValue({ status: 200 });

    mockTriggerProcessing.mockResolvedValue({
      jobId: 'job-123',
    });

    // Mock FileReader
    const mockReadAsDataURL = jest.fn();
    const mockFileReader: any = {
      readAsDataURL: mockReadAsDataURL,
      result: 'data:image/jpeg;base64,test',
    };

    global.FileReader = jest.fn(() => mockFileReader) as any;

    renderWithToast(<UploadInterface onUploadComplete={mockOnUploadComplete} />);

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen
      .getByRole('presentation')
      .querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    // Wait for FileReader
    await waitFor(() => {
      expect(mockReadAsDataURL).toHaveBeenCalled();
    });

    // Simulate FileReader completion
    mockFileReader.onloadend?.();

    // Wait for upload button
    await waitFor(() => {
      expect(screen.getByText('Upload & Process')).toBeInTheDocument();
    });

    // Click upload button
    fireEvent.click(screen.getByText('Upload & Process'));

    // Verify the upload workflow
    await waitFor(() => {
      expect(mockGetPresignedUrl).toHaveBeenCalledWith('test.jpg');
      expect(mockTriggerProcessing).toHaveBeenCalledWith('uploads/test.jpg');
      expect(mockOnUploadComplete).toHaveBeenCalledWith('job-123');
    });
  });

  it('displays error message on upload failure', async () => {
    const mockGetPresignedUrl = apiClient.getPresignedUrl as jest.Mock;
    mockGetPresignedUrl.mockRejectedValue(new Error('Network error'));

    // Mock FileReader
    const mockReadAsDataURL = jest.fn();
    const mockFileReader: any = {
      readAsDataURL: mockReadAsDataURL,
      result: 'data:image/jpeg;base64,test',
    };

    global.FileReader = jest.fn(() => mockFileReader) as any;

    renderWithToast(<UploadInterface onUploadComplete={mockOnUploadComplete} />);

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen
      .getByRole('presentation')
      .querySelector('input[type="file"]') as HTMLInputElement;

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    // Wait for FileReader
    await waitFor(() => {
      expect(mockReadAsDataURL).toHaveBeenCalled();
    });

    // Simulate FileReader completion
    mockFileReader.onloadend?.();

    // Wait for upload button
    await waitFor(() => {
      expect(screen.getByText('Upload & Process')).toBeInTheDocument();
    });

    // Click upload button
    fireEvent.click(screen.getByText('Upload & Process'));

    // Verify error is displayed
    await waitFor(() => {
      const errorMessages = screen.getAllByText(/Upload failed. Please try again/i);
      expect(errorMessages.length).toBeGreaterThan(0);
    });
  });
});
