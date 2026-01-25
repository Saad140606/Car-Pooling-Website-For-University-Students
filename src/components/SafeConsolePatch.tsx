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
          // Attempt to call the original console.error
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
