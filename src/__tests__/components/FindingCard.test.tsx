/**
 * FindingCard Component Tests
 *
 * Tests for the FindingCard component which displays security findings
 * with severity badges, governance indicators, and compliance tags.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FindingCard } from '@/components/FindingCard';
import type { Finding } from '@/lib/api';

// Mock the pattern labels module
jest.mock('@/lib/patternLabels', () => ({
  getPatternLabel: (patternId: string) => ({
    title: patternId === 'prompt_injection' ? 'Prompt Injection' : 'Unknown Pattern',
    shortDesc: 'Test description',
  }),
}));

// Base finding for tests
const baseFinding: Finding = {
  id: 'IR-001',
  pattern_id: 'prompt_injection',
  pattern: 'Prompt Injection',
  file: 'agent.py',
  line: 42,
  column: 8,
  severity: 'HIGH',
  confidence: 0.95,
  cwe: 'CWE-77',
  message: 'Prompt injection vulnerability detected',
  category: 'security',
  risk_tier: 'vulnerability',
  input_tainted: true,
  taint_source: 'user_input',
};

describe('FindingCard', () => {
  const mockOnClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render finding with correct severity badge', () => {
      render(<FindingCard finding={baseFinding} onClick={mockOnClick} />);

      expect(screen.getByText('HIGH')).toBeInTheDocument();
    });

    it('should render file location', () => {
      render(<FindingCard finding={baseFinding} onClick={mockOnClick} />);

      expect(screen.getByText('agent.py:42')).toBeInTheDocument();
    });

    it('should render pattern title from label', () => {
      render(<FindingCard finding={baseFinding} onClick={mockOnClick} />);

      expect(screen.getByText('Prompt Injection')).toBeInTheDocument();
    });

    it('should render CWE tag when present', () => {
      render(<FindingCard finding={baseFinding} onClick={mockOnClick} />);

      expect(screen.getByText('CWE-77')).toBeInTheDocument();
    });

    it('should render risk tier label for vulnerabilities', () => {
      render(<FindingCard finding={baseFinding} onClick={mockOnClick} />);

      expect(screen.getByText('Vulnerability')).toBeInTheDocument();
    });
  });

  describe('Severity Variants', () => {
    it('should render CRITICAL severity', () => {
      const criticalFinding = { ...baseFinding, severity: 'CRITICAL' as const };
      render(<FindingCard finding={criticalFinding} onClick={mockOnClick} />);

      const badge = screen.getByText('CRITICAL');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('text-red-700');
    });

    it('should render HIGH severity', () => {
      render(<FindingCard finding={baseFinding} onClick={mockOnClick} />);

      const badge = screen.getByText('HIGH');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('text-orange-700');
    });

    it('should render MEDIUM severity', () => {
      const mediumFinding = { ...baseFinding, severity: 'MEDIUM' as const };
      render(<FindingCard finding={mediumFinding} onClick={mockOnClick} />);

      const badge = screen.getByText('MEDIUM');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('text-amber-700');
    });

    it('should render LOW severity', () => {
      const lowFinding = { ...baseFinding, severity: 'LOW' as const };
      render(<FindingCard finding={lowFinding} onClick={mockOnClick} />);

      const badge = screen.getByText('LOW');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('text-blue-700');
    });
  });

  describe('Governance Findings', () => {
    it('should show governance badge for governance_violation finding_type', () => {
      const govFinding: Finding = {
        ...baseFinding,
        finding_type: 'governance_violation',
        governance_category: 'oversight',
      };
      render(<FindingCard finding={govFinding} onClick={mockOnClick} />);

      expect(screen.getByText('Governance')).toBeInTheDocument();
      expect(screen.getByText('Human Oversight')).toBeInTheDocument();
    });

    it('should show governance badge for missing_human_oversight pattern', () => {
      const govFinding: Finding = {
        ...baseFinding,
        pattern_id: 'missing_human_oversight',
        governance_category: 'oversight',
      };
      render(<FindingCard finding={govFinding} onClick={mockOnClick} />);

      expect(screen.getByText('Governance')).toBeInTheDocument();
    });

    it('should show authorization governance category', () => {
      const govFinding: Finding = {
        ...baseFinding,
        finding_type: 'governance_violation',
        governance_category: 'authorization',
      };
      render(<FindingCard finding={govFinding} onClick={mockOnClick} />);

      expect(screen.getByText('Authorization')).toBeInTheDocument();
    });

    it('should show audit governance category', () => {
      const govFinding: Finding = {
        ...baseFinding,
        finding_type: 'governance_violation',
        governance_category: 'audit',
      };
      render(<FindingCard finding={govFinding} onClick={mockOnClick} />);

      expect(screen.getByText('Audit Trail')).toBeInTheDocument();
    });

    it('should show privacy governance category', () => {
      const govFinding: Finding = {
        ...baseFinding,
        finding_type: 'governance_violation',
        governance_category: 'privacy',
      };
      render(<FindingCard finding={govFinding} onClick={mockOnClick} />);

      expect(screen.getByText('Privacy')).toBeInTheDocument();
    });

    it('should NOT show governance badge for regular vulnerabilities', () => {
      render(<FindingCard finding={baseFinding} onClick={mockOnClick} />);

      expect(screen.queryByText('Governance')).not.toBeInTheDocument();
    });
  });

  describe('Calibration Display', () => {
    it('should show calibrated confidence when available', () => {
      const calibratedFinding: Finding = {
        ...baseFinding,
        calibrated_confidence: 0.87,
        calibration_reliability: 'high',
        calibration_samples: 150,
      };
      render(<FindingCard finding={calibratedFinding} onClick={mockOnClick} />);

      expect(screen.getByText('87%')).toBeInTheDocument();
    });

    it('should apply green styling for high reliability', () => {
      const calibratedFinding: Finding = {
        ...baseFinding,
        calibrated_confidence: 0.92,
        calibration_reliability: 'high',
        calibration_samples: 200,
      };
      render(<FindingCard finding={calibratedFinding} onClick={mockOnClick} />);

      const confidenceBadge = screen.getByText('92%');
      expect(confidenceBadge).toHaveClass('bg-green-50');
      expect(confidenceBadge).toHaveClass('text-green-600');
    });

    it('should apply blue styling for moderate reliability', () => {
      const calibratedFinding: Finding = {
        ...baseFinding,
        calibrated_confidence: 0.75,
        calibration_reliability: 'moderate',
        calibration_samples: 50,
      };
      render(<FindingCard finding={calibratedFinding} onClick={mockOnClick} />);

      const confidenceBadge = screen.getByText('75%');
      expect(confidenceBadge).toHaveClass('bg-blue-50');
      expect(confidenceBadge).toHaveClass('text-blue-600');
    });

    it('should apply gray styling for insufficient reliability', () => {
      const calibratedFinding: Finding = {
        ...baseFinding,
        calibrated_confidence: 0.60,
        calibration_reliability: 'insufficient',
        calibration_samples: 5,
      };
      render(<FindingCard finding={calibratedFinding} onClick={mockOnClick} />);

      const confidenceBadge = screen.getByText('60%');
      expect(confidenceBadge).toHaveClass('bg-gray-100');
      expect(confidenceBadge).toHaveClass('text-gray-500');
    });
  });

  describe('Compliance Mapping', () => {
    it('should show EU AI Act article when available', () => {
      const findingWithCompliance: Finding = {
        ...baseFinding,
        cwe: '', // Empty CWE to test fallback
        compliance_mapping: {
          eu_ai_act_articles: ['Article 14'],
          nist_categories: ['MS-3'],
        },
      };
      render(<FindingCard finding={findingWithCompliance} onClick={mockOnClick} />);

      expect(screen.getByText('Article 14')).toBeInTheDocument();
    });

    it('should show OWASP category when no EU AI Act', () => {
      const findingWithOWASP: Finding = {
        ...baseFinding,
        cwe: '',
        compliance_mapping: {
          owasp_items: ['LLM01:2025'],
        },
      };
      render(<FindingCard finding={findingWithOWASP} onClick={mockOnClick} />);

      expect(screen.getByText('LLM01:2025')).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('should call onClick when card is clicked', () => {
      render(<FindingCard finding={baseFinding} onClick={mockOnClick} />);

      const card = screen.getByRole('button');
      fireEvent.click(card);

      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should be accessible via keyboard', () => {
      render(<FindingCard finding={baseFinding} onClick={mockOnClick} />);

      const card = screen.getByRole('button');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Risk Tier Labels', () => {
    it('should show "Vulnerability" for vulnerability tier', () => {
      render(<FindingCard finding={baseFinding} onClick={mockOnClick} />);
      expect(screen.getByText('Vulnerability')).toBeInTheDocument();
    });

    it('should show "Risk Pattern" for risk_pattern tier', () => {
      const riskPatternFinding = { ...baseFinding, risk_tier: 'risk_pattern' as const };
      render(<FindingCard finding={riskPatternFinding} onClick={mockOnClick} />);
      expect(screen.getByText('Risk Pattern')).toBeInTheDocument();
    });

    it('should show "Best Practice" for hardening tier', () => {
      const hardeningFinding = { ...baseFinding, risk_tier: 'hardening' as const };
      render(<FindingCard finding={hardeningFinding} onClick={mockOnClick} />);
      expect(screen.getByText('Best Practice')).toBeInTheDocument();
    });
  });
});
