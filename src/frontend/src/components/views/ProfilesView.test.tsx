// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { ProfilesView } from './ProfilesView';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { workspaceApi } from '@/api/client';
import { useWorkspaceStore } from '@/store/workspaceStore';

// Mock dependencies
vi.mock('@/api/client', () => ({
    workspaceApi: {
        getProfiles: vi.fn(),
        getProjects: vi.fn(),
    }
}));

vi.mock('@/store/workspaceStore', () => ({
    useWorkspaceStore: vi.fn()
}));

vi.mock('@/components/ui/toast', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn()
    }
}));

// Mock Lucide icons to avoid render issues in tests
vi.mock('lucide-react', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual as any,
    };
});

describe('ProfilesView', () => {
    const mockGetProfiles = workspaceApi.getProfiles as any;
    const mockUseWorkspaceStore = useWorkspaceStore as any;

    beforeEach(() => {
        vi.clearAllMocks();
        // Default store state
        mockUseWorkspaceStore.mockImplementation((selector: any) => {
            const state = {
                selectedCompanyId: '123',
                companies: [],
                fetchCompanies: vi.fn()
            };
            return selector ? selector(state) : state;
        });
    });

    it('renders and fetches profiles on mount', async () => {
        const mockData = [
            { id: '1', name: 'Agent 007', type: 'business_analyst', created_at: '2023-01-01', updated_at: '2023-01-01', company_id: '123' }
        ];
        mockGetProfiles.mockResolvedValue(mockData);

        render(<ProfilesView />);

        await waitFor(() => {
            expect(mockGetProfiles).toHaveBeenCalledWith('123');
        });

        await waitFor(() => {
            expect(screen.getByText('Agent 007')).toBeTruthy();
        });
    });

    it('handles API errors gracefully', async () => {
        mockGetProfiles.mockRejectedValue(new Error('API Error'));
        const { toast } = await import('@/components/ui/toast');

        render(<ProfilesView />);

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalled();
        });
    });

    it('does not fetch if no company selected', async () => {
        mockUseWorkspaceStore.mockImplementation((selector: any) => {
            const state = {
                selectedCompanyId: null,
                companies: [],
                fetchCompanies: vi.fn()
            };
            return selector ? selector(state) : state;
        });

        render(<ProfilesView />);

        expect(mockGetProfiles).not.toHaveBeenCalled();
        expect(screen.getByText('Please select a company to view profiles')).toBeTruthy();
    });
});
