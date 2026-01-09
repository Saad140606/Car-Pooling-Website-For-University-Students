// src/firebase/errors.ts
export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  public context: SecurityRuleContext;
  public hint?: string;
  constructor(context: SecurityRuleContext & { hint?: string }) {
    // Safe stringify to avoid issues with circular references or non-serializable values.
    const safeStringify = (obj: any) => {
      const seen = new WeakSet();
      return JSON.stringify(obj, function (_key, value) {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        if (typeof value === 'function') return `[Function ${value.name}]`;
        return value;
      }, 2);
    };
    const hint = context.hint ? `\nHint: ${context.hint}` : '';
    const message = `FirestoreError: Missing or insufficient permissions. The following request was denied by Firestore Security Rules:\n${safeStringify({ ...context })}${hint}`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
    this.hint = context.hint;
  }
}
