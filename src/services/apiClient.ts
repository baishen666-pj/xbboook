import type { ApiResponse } from "@/types/api";

const BASE_URL = "/api";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", body, headers = {} } = options;

  try {
    const config: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    if (body !== undefined && method !== "GET") {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(`${BASE_URL}${path}`, config);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        success: false,
        data: null,
        error: `请求失败 (${response.status}): ${errorText}`,
      };
    }

    const data: T = await response.json();
    return { success: true, data, error: null };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "网络请求失败";
    return { success: false, data: null, error: message };
  }
}

export const apiClient = {
  get<T>(path: string): Promise<ApiResponse<T>> {
    return request<T>(path);
  },

  post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return request<T>(path, { method: "POST", body });
  },

  put<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return request<T>(path, { method: "PUT", body });
  },

  patch<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return request<T>(path, { method: "PATCH", body });
  },

  delete<T>(path: string): Promise<ApiResponse<T>> {
    return request<T>(path, { method: "DELETE" });
  },
};
