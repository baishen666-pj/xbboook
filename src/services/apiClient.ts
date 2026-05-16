import type { ApiResponse } from "@/types/api";

const BASE_URL = "/api";

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

function toCamelCase(key: string): string {
  return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function transformKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(transformKeys);
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[toCamelCase(k)] = transformKeys(v);
    }
    return out;
  }
  return obj;
}

async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { method = "GET", body, headers = {} } = options;

  try {
    const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
    const config: RequestInit = {
      method,
      headers: isFormData
        ? { ...headers }
        : { "Content-Type": "application/json", ...headers },
    };

    if (body !== undefined && method !== "GET") {
      config.body = isFormData ? body : JSON.stringify(body);
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

    const json = await response.json();
    if (json.success !== undefined && json.data !== undefined) {
      return {
        success: json.success,
        data: transformKeys(json.data) as T,
        error: json.error ?? null,
      };
    }
    return { success: true, data: transformKeys(json) as T, error: null };
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

  upload<T>(path: string, formData: FormData): Promise<ApiResponse<T>> {
    return request<T>(path, { method: "POST", body: formData });
  },
};
