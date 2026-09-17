import axios from "axios";

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Thrown by provider services when a request ultimately fails (after
 * retry). Callers — specifically the Phase 3 aggregator using
 * Promise.allSettled — can catch this, log `provider`, and continue
 * with whichever other providers succeeded, per the "one provider
 * outage must not break the whole search" requirement.
 */
export class ProviderError extends Error {
  constructor(provider, message, cause) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
    this.provider = provider;
    this.cause = cause;
  }
}

/**
 * Creates a small axios instance pre-configured for one provider:
 * base URL, timeout, and default query params (e.g. the API key).
 *
 * @param {Object} options
 * @param {string} options.baseURL
 * @param {Record<string, string>} [options.headers]
 * @param {Record<string, string>} [options.defaultParams]
 * @returns {import("axios").AxiosInstance}
 */
export function createProviderClient({ baseURL, headers = {}, defaultParams = {} }) {
  const client = axios.create({
    baseURL,
    timeout: DEFAULT_TIMEOUT_MS,
    headers,
  });

  client.interceptors.request.use((requestConfig) => {
    requestConfig.params = { ...defaultParams, ...requestConfig.params };
    return requestConfig;
  });

  return client;
}

/**
 * Runs a request function, retrying exactly once if the failure looks
 * transient (timeout, network error, or a 5xx). Anything else — 4xx,
 * auth errors, bad requests — fails immediately since retrying would
 * just repeat the same failure and risks a retry storm under load.
 *
 * @param {string} provider - Provider name, used in the thrown error.
 * @param {() => Promise<import("axios").AxiosResponse>} requestFn
 * @returns {Promise<import("axios").AxiosResponse>}
 */
export async function requestWithSafeRetry(provider, requestFn) {
  try {
    return await requestFn();
  } catch (firstError) {
    if (!isTransient(firstError)) {
      throw toProviderError(provider, firstError);
    }
    try {
      return await requestFn();
    } catch (secondError) {
      throw toProviderError(provider, secondError);
    }
  }
}

function isTransient(error) {
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return true;
  if (!error.response) return true; // network error, DNS failure, etc.
  return error.response.status >= 500;
}

function toProviderError(provider, error) {
  if (error.response) {
    const status = error.response.status;
    const message =
      status === 401 || status === 403
        ? "Authentication failed — check the API key."
        : status === 429
          ? "Rate limit exceeded."
          : `Request failed with status ${status}.`;
    return new ProviderError(provider, message, error);
  }
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return new ProviderError(provider, "Request timed out.", error);
  }
  return new ProviderError(provider, error.message || "Unknown request failure.", error);
}

export default createProviderClient;
