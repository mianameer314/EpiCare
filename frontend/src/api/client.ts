const API_BASE_URL = import.meta.env.VITE_API_URL;
if (!API_BASE_URL) {
  throw new Error('VITE_API_URL is not defined in the environment variables.');
}

export class ApiError extends Error {
  constructor(public status: number, public message: string, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('access_token');
  
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Attempt to parse error message from backend
    let errorMessage = 'An error occurred';
    let errorData = null;
    try {
      errorData = await response.json();
      errorMessage = errorData.detail || errorMessage;
    } catch {
      // Ignore parsing errors for non-JSON responses
    }

    if (response.status === 401) {
      // Handle token expiration/refresh logic here if needed
      localStorage.removeItem('access_token');
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
  post: <T>(endpoint: string, data?: any, options?: RequestInit) => request<T>(endpoint, { 
    ...options, 
    method: 'POST', 
    body: data ? JSON.stringify(data) : undefined 
  }),
  put: <T>(endpoint: string, data?: any, options?: RequestInit) => request<T>(endpoint, { 
    ...options, 
    method: 'PUT', 
    body: data ? JSON.stringify(data) : undefined 
  }),
  delete: <T>(endpoint: string, options?: RequestInit) => request<T>(endpoint, { ...options, method: 'DELETE' }),
};
