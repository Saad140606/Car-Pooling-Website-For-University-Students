"use client";

import { useEffect } from 'react';

export default function SafeConsolePatch() {
  useEffect(() => {
    try {
      const orig = globalThis.console && globalThis.console.error;
      if (!orig) return;

      // If console.error is already wrapped by Next, avoid double-wrapping
      if ((orig as any).__safePatched) return;

      const safe = function patchedConsoleError(...args: any[]) {
        try {
          // Suppress Firebase permission-denied errors during initialization
          // These are expected when auth is still being established
          const errorStr = String(args[0] || '');
          if (
            errorStr.includes('Missing or insufficient permissions') &&
            (errorStr.includes('Firestore') || errorStr.includes('snapshot listener'))
          ) {
            // Log at debug level instead of error
            if (globalThis.console?.debug) {
              globalThis.console.debug(
                '[SafeConsolePatch] Suppressed Firebase permission error (expected during init):', 
                errorStr.substring(0, 100)
              );
            }
            return; // Don't call original error for this case
          }

          // Attempt to call the original console.error for all other errors
          return orig.apply(globalThis.console, args);
        } catch (e) {
          try {
            // Fallback: call original as a function
            return (orig as any)(...args);
          } catch (_) {
            // Last resort: fallback to default console.log
            try { globalThis.console.log(...args); } catch (_) { /* ignore */ }
          }
        }
      } as typeof console.error;

      try {
        Object.defineProperty(safe, '__safePatched', { value: true });
      } catch (_) {}

      try {
        // Replace console.error early with our safe wrapper
        globalThis.console.error = safe;
      } catch (e) {
        // If assignment fails (non-writable), try to patch by replacing function properties
        try {
          // @ts-ignore
          (globalThis.console as any).error = safe;
        } catch (_) {
          // cannot patch console - ignore
        }
      }
    } catch (e) {
      // Silent catch to avoid crashing the app during early boot
    }
  }, []);

  return null;
}
