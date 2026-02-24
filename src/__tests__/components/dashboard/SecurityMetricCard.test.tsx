/**
 * SecurityMetricCard Component Tests
 *
 * Tests for the SecurityMetricCard component which displays
 * dashboard metrics with icons, badges, and trend indicators.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Shield, AlertTriangle, Activity, Key } from 'lucide-react';
import { SecurityMetricCard } from '@/components/dashboard/SecurityMetricCard';

// Mock the Sparkline component since it's a visual component
jest.mock('@/components/ui/sparkline', () => ({
  Sparkline: ({ data }: { data: number[] }) => (
    <div data-testid="sparkline">Sparkline: {data.join(',')}</div>
  ),
}));

describe('SecurityMetricCard', () => {
  describe('Basic Rendering', () => {
    it('should render with title and value', () => {
      render(
        <SecurityMetricCard
          title="Total Scans"
          value={42}
          icon={Activity}
        />
      );

      expect(screen.getByText('Total Scans')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('should render string values', () => {
      render(
        <SecurityMetricCard
          title="Risk Score"
          value="85/100"
          icon={Shield}
        />
      );

      expect(screen.getByText('85/100')).toBeInTheDocument();
    });

    it('should render subtitle when provided', () => {
      render(
        <SecurityMetricCard
          title="API Keys"
          value={3}
          subtitle="2 active, 1 revoked"
          icon={Key}
        />
      );

      expect(screen.getByText('2 active, 1 revoked')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('should render default variant', () => {
      const { container } = render(
        <SecurityMetricCard
          title="Test"
          value={0}
          icon={Activity}
          variant="default"
        />
      );

      // Check icon background has muted styling (default variant uses bg-muted)
      const iconContainer = container.querySelector('.bg-muted');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should render success variant', () => {
      const { container } = render(
        <SecurityMetricCard
          title="Test"
          value={0}
          icon={Activity}
          variant="success"
        />
      );

      const iconContainer = container.querySelector('.bg-green-100');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should render warning variant', () => {
      const { container } = render(
        <SecurityMetricCard
          title="Test"
          value={0}
          icon={AlertTriangle}
          variant="warning"
        />
      );

      const iconContainer = container.querySelector('.bg-amber-100');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should render danger variant', () => {
      const { container } = render(
        <SecurityMetricCard
          title="Critical Issues"
          value={5}
          icon={AlertTriangle}
          variant="danger"
        />
      );

      const iconContainer = container.querySelector('.bg-red-100');
      expect(iconContainer).toBeInTheDocument();
    });

    it('should render info variant', () => {
      const { container } = render(
        <SecurityMetricCard
          title="Test"
          value={0}
          icon={Activity}
          variant="info"
        />
      );

      const iconContainer = container.querySelector('.bg-blue-100');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton when loading', () => {
      const { container } = render(
        <SecurityMetricCard
          title="Loading Metric"
          value={0}
          icon={Activity}
          loading={true}
        />
      );

      // Should show animated skeleton
      const skeleton = container.querySelector('.animate-pulse');
      expect(skeleton).toBeInTheDocument();

      // Value should not be visible
      expect(screen.queryByText('0')).not.toBeInTheDocument();
    });

    it('should show value when not loading', () => {
      render(
        <SecurityMetricCard
          title="Loaded Metric"
          value={100}
          icon={Activity}
          loading={false}
        />
      );

      expect(screen.getByText('100')).toBeInTheDocument();
    });
  });

  describe('Badge', () => {
    it('should render success badge', () => {
      render(
        <SecurityMetricCard
          title="Test"
          value={0}
          icon={Activity}
          badge={{ text: 'All Clear', variant: 'success' }}
        />
      );

      const badge = screen.getByText('All Clear');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-green-100');
      expect(badge).toHaveClass('text-green-700');
    });

    it('should render warning badge', () => {
      render(
        <SecurityMetricCard
          title="Test"
          value={0}
          icon={Activity}
          badge={{ text: 'Needs Attention', variant: 'warning' }}
        />
      );

      const badge = screen.getByText('Needs Attention');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-amber-100');
      expect(badge).toHaveClass('text-amber-700');
    });

    it('should render danger badge', () => {
      render(
        <SecurityMetricCard
          title="Test"
          value={0}
          icon={Activity}
          badge={{ text: 'Critical', variant: 'danger' }}
        />
      );

      const badge = screen.getByText('Critical');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-red-100');
      expect(badge).toHaveClass('text-red-700');
    });
  });

  describe('Trend Sparkline', () => {
    it('should render sparkline when trend data provided', () => {
      render(
        <SecurityMetricCard
          title="Weekly Scans"
          value={42}
          icon={Activity}
          trend={[10, 12, 15, 8, 20, 25, 42]}
        />
      );

      expect(screen.getByTestId('sparkline')).toBeInTheDocument();
    });

    it('should not render sparkline with insufficient data', () => {
      render(
        <SecurityMetricCard
          title="Weekly Scans"
          value={42}
          icon={Activity}
          trend={[42]}
        />
      );

      expect(screen.queryByTestId('sparkline')).not.toBeInTheDocument();
    });

    it('should not render sparkline when no trend data', () => {
      render(
        <SecurityMetricCard
          title="Weekly Scans"
          value={42}
          icon={Activity}
        />
      );

      expect(screen.queryByTestId('sparkline')).not.toBeInTheDocument();
    });
  });

  describe('Tooltip', () => {
    it('should render info icon when tooltip provided', () => {
      const { container } = render(
        <SecurityMetricCard
          title="Risk Score"
          value={85}
          icon={Shield}
          tooltip="7-day rolling average of security risk across all scans"
        />
      );

      // Info icon should be present (rendered as svg)
      const tooltipContainer = container.querySelector('.group');
      expect(tooltipContainer).toBeInTheDocument();
    });

    it('should not render info icon when no tooltip', () => {
      const { container } = render(
        <SecurityMetricCard
          title="Risk Score"
          value={85}
          icon={Shield}
        />
      );

      // Check there's no tooltip container with cursor-help
      const tooltipTrigger = container.querySelector('.cursor-help');
      expect(tooltipTrigger).not.toBeInTheDocument();
    });
  });

  describe('Complex Scenarios', () => {
    it('should render all optional features together', () => {
      render(
        <SecurityMetricCard
          title="Critical Issues"
          value={3}
          subtitle="Down from 5 last week"
          icon={AlertTriangle}
          variant="danger"
          badge={{ text: 'Trending Down', variant: 'success' }}
          trend={[8, 7, 6, 5, 4, 3, 3]}
          tooltip="Number of unresolved critical security findings"
        />
      );

      expect(screen.getByText('Critical Issues')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Down from 5 last week')).toBeInTheDocument();
      expect(screen.getByText('Trending Down')).toBeInTheDocument();
      expect(screen.getByTestId('sparkline')).toBeInTheDocument();
    });

    it('should handle zero value correctly', () => {
      render(
        <SecurityMetricCard
          title="Critical Issues"
          value={0}
          icon={Shield}
          variant="success"
          badge={{ text: 'All Clear', variant: 'success' }}
        />
      );

      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('All Clear')).toBeInTheDocument();
    });
  });
});
