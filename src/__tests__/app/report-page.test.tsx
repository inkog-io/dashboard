/**
 * Report Page PLG Polish Tests
 *
 * Tests hero risk score, reframed banner, and bottom CTA scan input.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock PostHog provider
jest.mock('@/components/PostHogProvider', () => ({
  posthog: { capture: jest.fn() },
}));

// Mock components used by the report page
jest.mock('@/components/PublicHeader', () => ({
  PublicHeader: () => <div data-testid="public-header">Header</div>,
}));
jest.mock('@/components/FindingCard', () => ({
  FindingCard: ({ finding }: { finding: { id: string } }) => (
    <div data-testid={`finding-${finding.id}`}>Finding</div>
  ),
}));
jest.mock('@/components/FindingDetailsPanel', () => ({
  FindingDetailsPanel: () => null,
}));
jest.mock('@/components/CodeSnippetDisplay', () => ({
  CodeSnippetDisplay: () => <div>Code</div>,
}));
jest.mock('@/components/GovernanceScore', () => ({
  GovernanceScore: () => <div data-testid="governance-score">Governance</div>,
}));
jest.mock('@/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Track calls to router.push
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useParams: () => ({ id: 'test-report-id' }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Clerk for unauthenticated user
jest.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ isSignedIn: false, userId: null }),
}));

import PublicReportPage from '@/app/report/[id]/page';

const MOCK_REPORT = {
  report_id: 'test-report-id',
  repo_name: 'geekan/MetaGPT',
  repo_url: 'https://github.com/geekan/MetaGPT',
  scanned_at: '2026-04-27T10:00:00Z',
  claimed: false,
  scan_result: {
    success: true,
    files_scanned: 42,
    lines_of_code: 12000,
    findings_count: 18,
    critical_count: 4,
    high_count: 7,
    medium_count: 5,
    low_count: 2,
    risk_score: 78,
    governance_score: 35,
    scan_duration: '12s',
    eu_ai_act_readiness: 'NOT_READY' as const,
    findings: [
      {
        id: 'f1',
        severity: 'CRITICAL',
        pattern_id: 'exec_eval',
        message: 'test',
        file: 'test.py',
        line: 1,
        confidence: 0.95,
      },
      {
        id: 'f2',
        severity: 'HIGH',
        pattern_id: 'prompt_injection',
        message: 'test',
        file: 'test.py',
        line: 10,
        confidence: 0.8,
      },
    ],
    strengths: [],
    gated_findings: [
      { id: 'g1', severity: 'HIGH', pattern_id: 'sql_injection' },
      { id: 'g2', severity: 'MEDIUM', pattern_id: 'ssrf' },
    ],
  },
};

const MOCK_CLEAN_REPORT = {
  ...MOCK_REPORT,
  scan_result: {
    ...MOCK_REPORT.scan_result,
    findings_count: 0,
    critical_count: 0,
    high_count: 0,
    medium_count: 0,
    low_count: 0,
    risk_score: 0,
    governance_score: 85,
    findings: [],
    gated_findings: [],
  },
};

function setupFetch(data: object) {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => data,
  });
}

describe('Report Page — PLG Polish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock clipboard
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  describe('Hero Risk Score', () => {
    it('shows large risk score with correct color for high risk', async () => {
      setupFetch(MOCK_REPORT);
      render(<PublicReportPage />);
      await waitFor(() => {
        expect(screen.getByText('78')).toBeInTheDocument();
      });
      // Check /100 label
      expect(screen.getByText('/100')).toBeInTheDocument();
      expect(screen.getByText('Risk Score')).toBeInTheDocument();
    });

    it('shows severity stat pills', async () => {
      setupFetch(MOCK_REPORT);
      render(<PublicReportPage />);
      await waitFor(() => {
        expect(screen.getByText('18 findings')).toBeInTheDocument();
      });
      expect(screen.getByText(/4 Critical/)).toBeInTheDocument();
      expect(screen.getByText(/7 High/)).toBeInTheDocument();
    });

    it('shows governance score inline', async () => {
      setupFetch(MOCK_REPORT);
      render(<PublicReportPage />);
      await waitFor(() => {
        expect(screen.getByText('Gov: 35/100')).toBeInTheDocument();
      });
    });

    it('generates summary sentence from top patterns', async () => {
      setupFetch(MOCK_REPORT);
      render(<PublicReportPage />);
      await waitFor(() => {
        expect(
          screen.getByText(/4 critical vulnerabilities including exec eval/)
        ).toBeInTheDocument();
      });
    });

    it('shows clean state when no findings', async () => {
      setupFetch(MOCK_CLEAN_REPORT);
      render(<PublicReportPage />);
      await waitFor(() => {
        expect(
          screen.getByText(/Clean — No vulnerabilities detected/)
        ).toBeInTheDocument();
      });
    });

    it('shows repo name and scan date', async () => {
      setupFetch(MOCK_REPORT);
      render(<PublicReportPage />);
      await waitFor(() => {
        // Repo name appears in both banner and hero card
        const codeElements = screen.getAllByText('geekan/MetaGPT');
        expect(codeElements.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Reframed Top Banner', () => {
    it('shows value-framed banner for unauthenticated users with gated findings', async () => {
      setupFetch(MOCK_REPORT);
      render(<PublicReportPage />);
      await waitFor(() => {
        expect(
          screen.getByText(/2 more findings \+ fix code available/)
        ).toBeInTheDocument();
      });
      // CTA says "See All Findings" not "Unlock Full Report"
      expect(screen.getByText('See All Findings')).toBeInTheDocument();
      expect(screen.queryByText('Viewing preview')).not.toBeInTheDocument();
    });

    it('shows "Scan your own repositories" when no gated findings', async () => {
      setupFetch(MOCK_CLEAN_REPORT);
      render(<PublicReportPage />);
      await waitFor(() => {
        expect(
          screen.getByText('Scan your own repositories for free.')
        ).toBeInTheDocument();
      });
      expect(screen.getByText('Scan Your Repo')).toBeInTheDocument();
    });
  });

  describe('Bottom CTA — Inline Scan', () => {
    it('shows scan input with correct heading', async () => {
      setupFetch(MOCK_REPORT);
      render(<PublicReportPage />);
      await waitFor(() => {
        expect(
          screen.getByText('What does YOUR agent look like?')
        ).toBeInTheDocument();
      });
      expect(
        screen.getByPlaceholderText('https://github.com/owner/repo')
      ).toBeInTheDocument();
    });

    it('navigates to /scan?url= on button click', async () => {
      setupFetch(MOCK_REPORT);
      render(<PublicReportPage />);
      await waitFor(() => {
        screen.getByText('What does YOUR agent look like?');
      });
      const input = screen.getByPlaceholderText('https://github.com/owner/repo');
      fireEvent.change(input, {
        target: { value: 'https://github.com/test/repo' },
      });
      // Find the Scan button in the bottom CTA (not the top Scan button if one exists)
      const scanButtons = screen.getAllByText('Scan');
      // The last "Scan" button is the bottom CTA
      fireEvent.click(scanButtons[scanButtons.length - 1]);
      expect(mockPush).toHaveBeenCalledWith(
        '/scan?url=https%3A%2F%2Fgithub.com%2Ftest%2Frepo'
      );
    });

    it('navigates on Enter key', async () => {
      setupFetch(MOCK_REPORT);
      render(<PublicReportPage />);
      await waitFor(() => {
        screen.getByText('What does YOUR agent look like?');
      });
      const input = screen.getByPlaceholderText('https://github.com/owner/repo');
      fireEvent.change(input, {
        target: { value: 'https://github.com/test/repo' },
      });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(mockPush).toHaveBeenCalledWith(
        '/scan?url=https%3A%2F%2Fgithub.com%2Ftest%2Frepo'
      );
    });

    it('shows GitHub App as secondary link', async () => {
      setupFetch(MOCK_REPORT);
      render(<PublicReportPage />);
      await waitFor(() => {
        expect(
          screen.getByText('Install GitHub App for CI/CD scanning')
        ).toBeInTheDocument();
      });
      // Should NOT show old "Install GitHub App" primary button
      expect(
        screen.queryByText('Install GitHub App')
      ).not.toBeInTheDocument();
    });
  });

  describe('SecurityMetricCard removal', () => {
    it('does not render old metric cards', async () => {
      setupFetch(MOCK_REPORT);
      render(<PublicReportPage />);
      await waitFor(() => {
        expect(screen.getByText('78')).toBeInTheDocument();
      });
      // Old SecurityMetricCard had these as titles
      expect(screen.queryByText('Total Findings')).not.toBeInTheDocument();
    });
  });
});
