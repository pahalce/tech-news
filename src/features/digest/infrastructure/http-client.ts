export async function fetchTextWithTimeout(input: {
  url: string;
  timeoutMs: number;
  failurePrefix: string;
}): Promise<string> {
  const response = await fetchWithTimeout(input.url, { timeoutMs: input.timeoutMs });
  if (!response.ok) {
    throw new Error(`${input.failurePrefix}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export async function fetchWithTimeout(
  url: string,
  options: { timeoutMs: number; init?: RequestInit },
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    return await fetch(url, {
      ...options.init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Fetch timed out after ${options.timeoutMs}ms: ${url}`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
