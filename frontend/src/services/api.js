/**
 * Base API client configuration
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Perform a JSON request to the backend API.
 * @param {string} endpoint - API path (e.g. '/api/ai/plan')
 * @param {RequestInit} [options]
 */
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || `Request failed with status ${response.status}`);
  }

  return response.json();
}
