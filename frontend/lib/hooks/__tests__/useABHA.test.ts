import { renderHook, waitFor } from '@testing-library/react';
import { useABHA } from '../useABHA';
import * as abhaServiceModule from '@/lib/auth/abha-service';

// Mock the ABHA service
jest.mock('@/lib/auth/abha-service', () => ({
  createABHAService: jest.fn(() => ({
    validateABHAId: jest.fn(),
    requestOTP: jest.fn(),
    verifyAndLink: jest.fn(),
    getLinkStatus: jest.fn(),
    unlinkABHA: jest.fn(),
    fetchABDMRecords: jest.fn(),
  })),
}));

describe('useABHA', () => {
  let mockService: any;

  beforeEach(() => {
    mockService = (abhaServiceModule.createABHAService as any)();
    jest.clearAllMocks();
  });

  describe('loadLinkStatus', () => {
    it('should load link status on mount when autoLoad is true', async () => {
      const mockStatus = {
        linked: true,
        abhaId: '12-3456-7890-1234',
        linkedAt: '2024-01-15T10:00:00Z',
      };

      mockService.getLinkStatus.mockResolvedValueOnce(mockStatus);

      const { result } = renderHook(() => useABHA({ accessToken: 'test-token', autoLoad: true }));

      await waitFor(() => {
        expect(result.current.linkStatus).toEqual(mockStatus);
      });

      expect(mockService.getLinkStatus).toHaveBeenCalledWith('test-token');
    });

    it('should not load link status when autoLoad is false', () => {
      const { result } = renderHook(() => useABHA({ accessToken: 'test-token', autoLoad: false }));

      expect(result.current.linkStatus).toBeNull();
      expect(mockService.getLinkStatus).not.toHaveBeenCalled();
    });

    it('should not load link status when accessToken is null', () => {
      const { result } = renderHook(() => useABHA({ accessToken: null, autoLoad: true }));

      expect(result.current.linkStatus).toBeNull();
      expect(mockService.getLinkStatus).not.toHaveBeenCalled();
    });
  });

  describe('validateABHAId', () => {
    it('should validate ABHA ID format', () => {
      mockService.validateABHAId.mockReturnValueOnce(true);

      const { result } = renderHook(() => useABHA({ accessToken: 'test-token' }));

      const isValid = result.current.validateABHAId('12-3456-7890-1234');

      expect(isValid).toBe(true);
      expect(mockService.validateABHAId).toHaveBeenCalledWith('12-3456-7890-1234');
    });
  });

  describe('requestOTP', () => {
    it('should request OTP and store transaction ID', async () => {
      const mockResponse = {
        txnId: 'test-txn-123',
        message: 'OTP sent successfully',
      };

      mockService.requestOTP.mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useABHA({ accessToken: 'test-token' }));

      let response;
      await waitFor(async () => {
        response = await result.current.requestOTP('12-3456-7890-1234');
      });

      expect(response).toEqual(mockResponse);
      expect(result.current.otpTxnId).toBe('test-txn-123');
      expect(mockService.requestOTP).toHaveBeenCalledWith('12-3456-7890-1234');
    });

    it('should handle request OTP errors', async () => {
      mockService.requestOTP.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useABHA({ accessToken: 'test-token' }));

      await expect(result.current.requestOTP('12-3456-7890-1234')).rejects.toThrow('Network error');

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });
    });
  });

  describe('verifyAndLink', () => {
    it('should verify OTP and link ABHA ID', async () => {
      const mockResponse = {
        success: true,
        abhaId: '12-3456-7890-1234',
        name: 'Test User',
        dateOfBirth: '1990-01-01',
        gender: 'M',
      };

      mockService.verifyAndLink.mockResolvedValueOnce(mockResponse);
      mockService.getLinkStatus.mockResolvedValueOnce({
        linked: true,
        abhaId: '12-3456-7890-1234',
      });

      const { result } = renderHook(() => useABHA({ accessToken: 'test-token' }));

      // Set transaction ID first
      await waitFor(async () => {
        mockService.requestOTP.mockResolvedValueOnce({ txnId: 'test-txn-123' });
        await result.current.requestOTP('12-3456-7890-1234');
      });

      let response;
      await waitFor(async () => {
        response = await result.current.verifyAndLink('12-3456-7890-1234', '123456');
      });

      expect(response).toEqual(mockResponse);
      expect(result.current.otpTxnId).toBeNull();
      expect(mockService.verifyAndLink).toHaveBeenCalledWith(
        '12-3456-7890-1234',
        '123456',
        'test-txn-123',
        'test-token'
      );
    });

    it('should throw error when access token is missing', async () => {
      const { result } = renderHook(() => useABHA({ accessToken: null }));

      await expect(result.current.verifyAndLink('12-3456-7890-1234', '123456')).rejects.toThrow(
        'Access token is required'
      );
    });

    it('should throw error when transaction ID is missing', async () => {
      const { result } = renderHook(() => useABHA({ accessToken: 'test-token' }));

      await expect(result.current.verifyAndLink('12-3456-7890-1234', '123456')).rejects.toThrow(
        'Transaction ID is required'
      );
    });
  });

  describe('unlinkABHA', () => {
    it('should unlink ABHA ID successfully', async () => {
      mockService.unlinkABHA.mockResolvedValueOnce(undefined);
      mockService.getLinkStatus.mockResolvedValueOnce({ linked: false });

      const { result } = renderHook(() => useABHA({ accessToken: 'test-token' }));

      await waitFor(async () => {
        await result.current.unlinkABHA();
      });

      expect(mockService.unlinkABHA).toHaveBeenCalledWith('test-token');
      expect(mockService.getLinkStatus).toHaveBeenCalled();
    });

    it('should throw error when access token is missing', async () => {
      const { result } = renderHook(() => useABHA({ accessToken: null }));

      await expect(result.current.unlinkABHA()).rejects.toThrow('Access token is required');
    });
  });

  describe('fetchABDMRecords', () => {
    it('should fetch ABDM records successfully', async () => {
      const mockRecords = {
        resourceType: 'Bundle',
        entry: [],
      };

      mockService.fetchABDMRecords.mockResolvedValueOnce(mockRecords);

      const { result } = renderHook(() => useABHA({ accessToken: 'test-token' }));

      let records;
      await waitFor(async () => {
        records = await result.current.fetchABDMRecords();
      });

      expect(records).toEqual(mockRecords);
      expect(mockService.fetchABDMRecords).toHaveBeenCalledWith('test-token');
    });

    it('should throw error when access token is missing', async () => {
      const { result } = renderHook(() => useABHA({ accessToken: null }));

      await expect(result.current.fetchABDMRecords()).rejects.toThrow('Access token is required');
    });
  });

  describe('loading state', () => {
    it('should set loading state during async operations', async () => {
      mockService.requestOTP.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ txnId: '123' }), 100))
      );

      const { result } = renderHook(() => useABHA({ accessToken: 'test-token' }));

      const promise = result.current.requestOTP('12-3456-7890-1234');

      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      await promise;

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });
});
