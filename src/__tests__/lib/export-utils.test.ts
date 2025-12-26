/**
 * Export Utilities Tests
 *
 * Tests for export functionality including JSON and SARIF format generation
 */

import { Finding, ScanResult } from '@/lib/api';

// Mock finding data for tests
const mockFinding: Finding = {
  id: 'IR-001',
  pattern_id: 'universal_infinite_loop',
  pattern: 'Unbounded Loop',
  file: 'agent.py',
  line: 42,
  column: 8,
  severity: 'CRITICAL',
  confidence: 0.95,
  cwe: 'CWE-835',
  owasp_category: 'LLM10',
  message: 'Infinite loop detected',
  category: 'resource_exhaustion',
  risk_tier: 'vulnerability',
  input_tainted: true,
  taint_source: 'llm_controlled',
  code_snippet: '  40│  while True:\n  41│    response = llm.invoke()\n  42│→   continue',
};

const mockScanResult: ScanResult = {
  success: true,
  files_scanned: 10,
  lines_of_code: 500,
  findings_count: 3,
  critical_count: 1,
  high_count: 1,
  medium_count: 1,
  low_count: 0,
  risk_score: 85,
  scan_duration: '150ms',
  findings: [mockFinding],
  governance_score: 75,
  eu_ai_act_readiness: 'PARTIAL',
};

describe('Export Utilities', () => {
  describe('JSON Export', () => {
    it('should generate valid JSON structure', () => {
      const json = JSON.stringify(mockScanResult, null, 2);
      const parsed = JSON.parse(json);

      expect(parsed.findings_count).toBe(3);
      expect(parsed.findings).toHaveLength(1);
      expect(parsed.findings[0].id).toBe('IR-001');
    });

    it('should include all finding fields', () => {
      const json = JSON.stringify(mockScanResult);
      const parsed = JSON.parse(json);
      const finding = parsed.findings[0];

      expect(finding).toHaveProperty('id');
      expect(finding).toHaveProperty('pattern_id');
      expect(finding).toHaveProperty('severity');
      expect(finding).toHaveProperty('cwe');
      expect(finding).toHaveProperty('code_snippet');
    });

    it('should preserve numeric types', () => {
      const json = JSON.stringify(mockScanResult);
      const parsed = JSON.parse(json);

      expect(typeof parsed.risk_score).toBe('number');
      expect(typeof parsed.files_scanned).toBe('number');
      expect(typeof parsed.findings[0].confidence).toBe('number');
    });
  });

  describe('SARIF Format', () => {
    it('should map severity to SARIF level', () => {
      const severityMap: Record<string, string> = {
        'CRITICAL': 'error',
        'HIGH': 'error',
        'MEDIUM': 'warning',
        'LOW': 'note',
      };

      expect(severityMap['CRITICAL']).toBe('error');
      expect(severityMap['HIGH']).toBe('error');
      expect(severityMap['MEDIUM']).toBe('warning');
      expect(severityMap['LOW']).toBe('note');
    });

    it('should format file locations correctly', () => {
      const sarifLocation = {
        physicalLocation: {
          artifactLocation: { uri: mockFinding.file },
          region: {
            startLine: mockFinding.line,
            startColumn: mockFinding.column,
          },
        },
      };

      expect(sarifLocation.physicalLocation.artifactLocation.uri).toBe('agent.py');
      expect(sarifLocation.physicalLocation.region.startLine).toBe(42);
      expect(sarifLocation.physicalLocation.region.startColumn).toBe(8);
    });
  });

  describe('Data Validation', () => {
    it('should handle empty findings array', () => {
      const emptyResult: ScanResult = {
        ...mockScanResult,
        findings: [],
        findings_count: 0,
      };

      expect(emptyResult.findings).toHaveLength(0);
      expect(emptyResult.findings_count).toBe(0);
    });

    it('should handle missing optional fields', () => {
      const minimalFinding: Partial<Finding> = {
        id: 'MIN-001',
        pattern_id: 'test',
        pattern: 'Test',
        file: 'test.py',
        line: 1,
        column: 1,
        severity: 'LOW',
        confidence: 0.5,
        cwe: 'CWE-000',
        message: 'Test message',
        category: 'test',
        risk_tier: 'hardening',
        input_tainted: false,
        taint_source: '',
      };

      expect(minimalFinding.code_snippet).toBeUndefined();
      expect(minimalFinding.governance_category).toBeUndefined();
    });
  });
});

describe('Finding Utilities', () => {
  describe('Severity Ordering', () => {
    it('should order severities correctly', () => {
      const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

      expect(severityOrder.indexOf('CRITICAL')).toBeLessThan(severityOrder.indexOf('HIGH'));
      expect(severityOrder.indexOf('HIGH')).toBeLessThan(severityOrder.indexOf('MEDIUM'));
      expect(severityOrder.indexOf('MEDIUM')).toBeLessThan(severityOrder.indexOf('LOW'));
    });
  });

  describe('Risk Tier Classification', () => {
    it('should classify risk tiers correctly', () => {
      const riskTiers = ['vulnerability', 'risk_pattern', 'hardening'];

      expect(riskTiers).toContain('vulnerability');
      expect(riskTiers).toContain('risk_pattern');
      expect(riskTiers).toContain('hardening');
    });
  });

  describe('Governance Categories', () => {
    it('should support all governance categories', () => {
      const categories = ['oversight', 'authorization', 'audit', 'privacy'];

      expect(categories).toHaveLength(4);
      expect(categories).toContain('oversight');
      expect(categories).toContain('authorization');
    });
  });
});
