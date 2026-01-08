/**
 * Toast Hook
 *
 * Provides consistent toast notifications throughout the dashboard.
 * Wraps Sonner toast with enterprise-grade error handling.
 */

import { toast } from 'sonner';
import { InkogAPIError } from '@/lib/api';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  title: string;
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * User-friendly error messages for common API error codes
 */
const ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: 'Please sign in to continue',
  invalid_token: 'Your session has expired. Please sign in again.',
  rate_limited: 'Too many requests. Please wait a moment and try again.',
  insufficient_permissions: 'You do not have permission to perform this action',
  resource_not_found: 'The requested resource could not be found',
  server_error: 'An unexpected error occurred. Please try again later.',
  network_error: 'Unable to connect to the server. Please check your connection.',
  scan_failed: 'The scan could not be completed. Please try again.',
  file_too_large: 'One or more files exceed the maximum size limit',
  unsupported_file_type: 'One or more files are not supported',
  key_already_exists: 'An API key with this name already exists',
  key_not_found: 'The API key could not be found',
  key_revoked: 'This API key has already been revoked',
};

/**
 * Hook for showing toast notifications
 */
export function useToast() {
  /**
   * Show a success toast
   */
  const success = (options: ToastOptions) => {
    toast.success(options.title, {
      description: options.description,
      duration: options.duration,
      action: options.action ? {
        label: options.action.label,
        onClick: options.action.onClick,
      } : undefined,
    });
  };

  /**
   * Show an error toast with user-friendly message
   */
  const error = (options: ToastOptions) => {
    toast.error(options.title, {
      description: options.description,
      duration: options.duration ?? 8000, // Errors stay longer
      action: options.action ? {
        label: options.action.label,
        onClick: options.action.onClick,
      } : undefined,
    });
  };

  /**
   * Show a warning toast
   */
  const warning = (options: ToastOptions) => {
    toast.warning(options.title, {
      description: options.description,
      duration: options.duration ?? 6000,
      action: options.action ? {
        label: options.action.label,
        onClick: options.action.onClick,
      } : undefined,
    });
  };

  /**
   * Show an info toast
   */
  const info = (options: ToastOptions) => {
    toast.info(options.title, {
      description: options.description,
      duration: options.duration,
      action: options.action ? {
        label: options.action.label,
        onClick: options.action.onClick,
      } : undefined,
    });
  };

  /**
   * Handle API errors with user-friendly messages
   */
  const handleAPIError = (err: unknown, fallbackMessage?: string) => {
    if (err instanceof InkogAPIError) {
      // Get user-friendly message for the error code
      const userMessage = ERROR_MESSAGES[err.code] || err.message;

      error({
        title: 'Error',
        description: userMessage,
      });

      // Log full error for debugging (development only)
      if (process.env.NODE_ENV === 'development') {
        console.error('[API Error]', {
          code: err.code,
          status: err.status,
          message: err.message,
        });
      }
    } else if (err instanceof TypeError && err.message.includes('fetch')) {
      // Network error
      error({
        title: 'Connection Error',
        description: ERROR_MESSAGES.network_error,
      });
    } else if (err instanceof Error) {
      error({
        title: 'Error',
        description: err.message || fallbackMessage || 'An unexpected error occurred',
      });
    } else {
      error({
        title: 'Error',
        description: fallbackMessage || 'An unexpected error occurred',
      });
    }
  };

  /**
   * Show a loading toast with promise support
   */
  const promise = <T,>(
    promiseOrFn: Promise<T> | (() => Promise<T>),
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    }
  ) => {
    return toast.promise(promiseOrFn, {
      loading: options.loading,
      success: options.success,
      error: options.error,
    });
  };

  /**
   * Dismiss all toasts
   */
  const dismissAll = () => {
    toast.dismiss();
  };

  return {
    success,
    error,
    warning,
    info,
    handleAPIError,
    promise,
    dismissAll,
  };
}

/**
 * Standalone toast functions for use outside of components
 */
export const toastStandalone = {
  success: (title: string, description?: string) => {
    toast.success(title, { description });
  },
  error: (title: string, description?: string) => {
    toast.error(title, { description, duration: 8000 });
  },
  warning: (title: string, description?: string) => {
    toast.warning(title, { description });
  },
  info: (title: string, description?: string) => {
    toast.info(title, { description });
  },
  dismiss: () => {
    toast.dismiss();
  },
};
