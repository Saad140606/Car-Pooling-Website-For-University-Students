/**
 * Fetch wrapper with timeout support
 * Automatically aborts requests that exceed time limit
 */

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
}

/**
 * Fetch with automatic timeout
 * Throws a clear timeout error if request exceeds time limit
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 30000, // 30 seconds default
    retries = 0,
    ...fetchOptions
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Check for non-2xx status codes
    if (!response.ok) {
      const error = new Error(
        `HTTP ${response.status}: ${response.statusText} from ${url}`
      );
      (error as any).statusCode = response.status;
      throw error;
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort error (timeouts)
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = new Error(
        `Request timeout after ${timeoutMs}ms: ${url}`
      );
      timeoutError.name = 'TimeoutError';
      (timeoutError as any).statusCode = 408; // Request Timeout
      throw timeoutError;
    }

    // Re-throw other errors
    throw error;
  }
}

/**
 * Fetch with retry support
 */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { retries = 3, timeoutMs = 30000, ...fetchOptions } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fetchWithTimeout(url, {
        timeoutMs,
        ...fetchOptions,
      });
    } catch (error) {
      lastError = error as Error;

      // Don't retry on non-retryable errors
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        const statusCode = (error as any).statusCode;

        // Don't retry on 4xx client errors
        if (statusCode && statusCode >= 400 && statusCode < 500) {
          throw error;
        }

        // Don't retry on 301-308 redirects handled by browser
        if (statusCode && statusCode >= 301 && statusCode <= 308) {
          throw error;
        }
      }

      // Log retry attempt
      if (attempt < retries - 1) {
        const delayMs = Math.pow(2, attempt) * 1000; // Exponential backoff
        console.warn(
          `[FetchRetry] Attempt ${attempt + 1}/${retries} failed, retrying in ${delayMs}ms...`,
          error
        );

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // All retries exhausted
  if (lastError) {
    throw lastError;
  }

  throw new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

/**
 * Abort controller for managing fetch requests
 * Useful for cancelling requests when component unmounts or user navigates
 */
export class FetchController {
  private controllers: Map<string, AbortController> = new Map();

  /**
   * Get or create an abort controller for a request
   */
  getController(key: string): AbortController {
    if (!this.controllers.has(key)) {
      this.controllers.set(key, new AbortController());
    }
    return this.controllers.get(key)!;
  }

  /**
   * Abort a specific request
   */
  abort(key: string): void {
    const controller = this.controllers.get(key);
    if (controller) {
      controller.abort();
      this.controllers.delete(key);
    }
  }

  /**
   * Abort all pending requests
   */
  abortAll(): void {
    this.controllers.forEach(controller => controller.abort());
    this.controllers.clear();
  }

  /**
   * Get signal for a specific request
   */
  getSignal(key: string): AbortSignal {
    return this.getController(key).signal;
  }
}
