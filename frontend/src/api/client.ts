const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function extractErrorMessage(errorData: any, defaultMessage: string): string {
  if (!errorData) return defaultMessage;

  // 1. EpiCare custom envelope: { error: { message: "...", code: "..." } }
  if (errorData.error?.message && typeof errorData.error.message === 'string') {
    return errorData.error.message;
  }

  // 2. Standard FastAPI detail as string
  if (typeof errorData.detail === 'string') {
    return errorData.detail;
  }

  // 3. FastAPI Pydantic validation error list: { detail: [{ msg: "...", loc: [...] }] }
  if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
    const firstErr = errorData.detail[0];
    if (firstErr?.msg) {
      const field = firstErr.loc?.[firstErr.loc.length - 1];
      return field ? `${field}: ${firstErr.msg}` : firstErr.msg;
    }
  }

  // 4. Generic message field
  if (typeof errorData.message === 'string') {
    return errorData.message;
  }

  return defaultMessage;
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function handleTokenRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshToken}`,
      },
    });

    if (!res.ok) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('auth_user');
      return null;
    }

    const data = await res.json();
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
      }
      return data.access_token;
    }
    return null;
  } catch {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_user');
    return null;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<T> {
  const token = localStorage.getItem('access_token');

  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const method = (options.method || 'GET').toUpperCase();
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  // Project-wide automatic Idempotency Key for all mutating operations
  if (isMutating && !headers.has('X-Idempotency-Key')) {
    const idemKey = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    headers.set('X-Idempotency-Key', idemKey);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new ApiError(
      0,
      'Unable to connect to the server. Please ensure the backend is running.',
      err
    );
  }

  // Handle 401 Unauthorized & Token Refresh
  if (response.status === 401 && retryCount === 0 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await handleTokenRefresh();
        isRefreshing = false;
        if (newToken) {
          onRefreshed(newToken);
          headers.set('Authorization', `Bearer ${newToken}`);
          return request<T>(endpoint, { ...options, headers }, retryCount + 1);
        }
      } else {
        // Wait for token refresh to complete
        return new Promise<T>((resolve) => {
          subscribeTokenRefresh((newToken) => {
            headers.set('Authorization', `Bearer ${newToken}`);
            resolve(request<T>(endpoint, { ...options, headers }, retryCount + 1));
          });
        });
      }
    }

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_user');
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    let errorData = null;
    try {
      errorData = await response.json();
      errorMessage = extractErrorMessage(errorData, errorMessage);
    } catch {
      // Ignore parsing errors for non-JSON responses
    }

    throw new ApiError(response.status, errorMessage, errorData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestInit) => request<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, data?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
    }),
  put: <T>(endpoint: string, data?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
    }),
  patch: <T>(endpoint: string, data?: any, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
    }),
  delete: <T>(endpoint: string, options?: RequestInit) => request<T>(endpoint, { ...options, method: 'DELETE' }),
};
