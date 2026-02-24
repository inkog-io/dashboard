'use client';

import { useState, useEffect } from 'react';
import { hasMadeChoice, setConsent } from '@/lib/consent';
import { posthog } from '@/components/PostHogProvider';

const COMMAND = 'inkog verify --target app.inkog.io';

const RESULTS = [
  { label: 'Analytics', value: '1 (EU hosted)' },
  { label: 'Cross-site', value: 'none' },
  { label: 'Data shared', value: 'never' },
];

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [typed, setTyped] = useState('');
  const [phase, setPhase] = useState<'typing' | 'results' | 'ready'>('typing');

  useEffect(() => {
    if (hasMadeChoice()) return;
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!visible) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      const raf = requestAnimationFrame(() => {
        setTyped(COMMAND);
        setPhase('ready');
      });
      return () => cancelAnimationFrame(raf);
    }

    let i = 0;
    const interval = setInterval(() => {
      i++;
      setTyped(COMMAND.slice(0, i));
      if (i >= COMMAND.length) {
        clearInterval(interval);
        setTimeout(() => setPhase('results'), 150);
        setTimeout(() => setPhase('ready'), 700);
      }
    }, 25);
    return () => clearInterval(interval);
  }, [visible]);

  function accept() {
    setConsent('accepted');
    setVisible(false);
    // Upgrade PostHog from memory-only to full tracking
    posthog.set_config({ persistence: 'localStorage+cookie', person_profiles: 'always' });
    window.dispatchEvent(new Event('consent-updated'));
  }

  function decline() {
    setConsent('declined');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-6 right-6 sm:left-auto sm:max-w-sm z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-gray-950 border border-gray-800 rounded-lg shadow-2xl overflow-hidden font-mono text-xs">
        {/* Title bar */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-800/50">
          <div className="w-2 h-2 rounded-full bg-red-500/70" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/70" />
          <div className="w-2 h-2 rounded-full bg-green-500/70" />
          <span className="ml-2 text-gray-600 text-[10px]">privacy</span>
        </div>

        {/* Terminal body */}
        <div className="px-3 py-2.5 space-y-2">
          {/* Command line */}
          <div className="text-gray-300">
            <span className="text-green-400">$</span>{' '}
            <span>{typed}</span>
            {phase === 'typing' && (
              <span className="animate-pulse text-green-400">&#9610;</span>
            )}
          </div>

          {/* Scan results */}
          {phase !== 'typing' && (
            <div className="space-y-1">
              {RESULTS.map((r) => (
                <div key={r.label} className="flex items-center">
                  <span className="text-green-400 mr-2">&#10003;</span>
                  <span className="text-gray-500">{r.label}</span>
                  <span className="flex-1 mx-2 border-b border-dotted border-gray-800" />
                  <span className="text-gray-300">{r.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Action area */}
          {phase === 'ready' && (
            <div className="pt-1 space-y-2">
              <p className="text-gray-600">
                Allow cookies for analytics.{' '}
                <a
                  href="https://inkog.io/trust/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors"
                >
                  Policy
                </a>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={accept}
                  className="px-3 py-1 rounded border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-colors"
                >
                  Allow
                </button>
                <button
                  onClick={decline}
                  className="px-3 py-1 rounded border border-gray-700 text-gray-500 hover:bg-gray-800 transition-colors"
                >
                  Deny
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
