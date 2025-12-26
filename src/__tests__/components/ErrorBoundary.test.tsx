/**
 * ErrorBoundary Component Tests
 *
 * Tests for the ErrorBoundary component which provides graceful
 * crash isolation and error reporting.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, withErrorBoundary } from '@/components/ErrorBoundary';

// Mock PostHog
jest.mock('@/components/PostHogProvider', () => ({
  posthog: {
    capture: jest.fn(),
  },
}));

// Import the mocked posthog for assertions
import { posthog } from '@/components/PostHogProvider';

// Component that throws an error for testing
const ThrowingComponent = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Component rendered successfully</div>;
};

// Suppress console.error for expected errors
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalError;
});

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Normal Operation', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('should render multiple children', () => {
      render(
        <ErrorBoundary>
          <div>First child</div>
          <div>Second child</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('First child')).toBeInTheDocument();
      expect(screen.getByText('Second child')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should render fallback UI when child throws', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText(/This component encountered an error/)).toBeInTheDocument();
    });

    it('should render custom fallback when provided', () => {
      render(
        <ErrorBoundary fallback={<div>Custom error message</div>}>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom error message')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('should call onError callback when error occurs', () => {
      const onError = jest.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it('should report error to PostHog', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      expect(posthog.capture).toHaveBeenCalledWith('error_boundary_triggered', {
        error_name: 'Error',
        error_message: 'Test error',
        component_stack: expect.any(String),
      });
    });
  });

  describe('Recovery', () => {
    it('should allow retry by clicking "Try again" button', () => {
      let shouldThrow = true;

      const ConditionalThrower = () => {
        if (shouldThrow) {
          throw new Error('Test error');
        }
        return <div>Recovered successfully</div>;
      };

      render(
        <ErrorBoundary>
          <ConditionalThrower />
        </ErrorBoundary>
      );

      // Initially shows error
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Fix the error condition before clicking retry
      shouldThrow = false;

      // Click retry button
      const retryButton = screen.getByRole('button', { name: /Try again/i });
      fireEvent.click(retryButton);

      // Should now show recovered content
      expect(screen.getByText('Recovered successfully')).toBeInTheDocument();
    });

    it('should show error again if retry fails', () => {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // Click retry (component will still throw)
      const retryButton = screen.getByRole('button', { name: /Try again/i });
      fireEvent.click(retryButton);

      // Should still show error state
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('Error Details in Development', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('should show error details in development mode', () => {
      process.env.NODE_ENV = 'development';

      render(
        <ErrorBoundary>
          <ThrowingComponent />
        </ErrorBoundary>
      );

      // Error message should be displayed in dev mode
      expect(screen.getByText('Test error')).toBeInTheDocument();
    });
  });

  describe('Isolation', () => {
    it('should not affect sibling components', () => {
      render(
        <div>
          <ErrorBoundary>
            <ThrowingComponent />
          </ErrorBoundary>
          <div>Sibling component</div>
        </div>
      );

      // Error boundary should catch error
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      // Sibling should still render
      expect(screen.getByText('Sibling component')).toBeInTheDocument();
    });
  });
});

describe('withErrorBoundary HOC', () => {
  it('should wrap component with error boundary', () => {
    const SafeComponent = () => <div>Safe content</div>;
    const WrappedComponent = withErrorBoundary(SafeComponent);

    render(<WrappedComponent />);

    expect(screen.getByText('Safe content')).toBeInTheDocument();
  });

  it('should catch errors in wrapped component', () => {
    const WrappedThrowing = withErrorBoundary(ThrowingComponent);

    render(<WrappedThrowing />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should use custom fallback in HOC', () => {
    const WrappedThrowing = withErrorBoundary(
      ThrowingComponent,
      <div>HOC custom fallback</div>
    );

    render(<WrappedThrowing />);

    expect(screen.getByText('HOC custom fallback')).toBeInTheDocument();
  });

  it('should pass props through to wrapped component', () => {
    const PropsComponent = ({ message }: { message: string }) => (
      <div>{message}</div>
    );
    const WrappedProps = withErrorBoundary(PropsComponent);

    render(<WrappedProps message="Hello from props" />);

    expect(screen.getByText('Hello from props')).toBeInTheDocument();
  });
});
