import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/services/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

import { userPreferenceService } from "../../src/services/userPreferenceService";
import { apiClient } from "../../src/services/apiClient";

describe("userPreferenceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getPreferences fetches user preferences", async () => {
    const prefs = { autoSaveInterval: "3000", defaultAiTemperature: "0.7" };
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: prefs,
    });

    const result = await userPreferenceService.getPreferences("user-1");
    expect(result).toEqual(prefs);
    expect(apiClient.get).toHaveBeenCalledWith("/users/user-1/preferences");
  });

  it("getPreferences returns empty object on failure", async () => {
    (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: "unauthorized",
    });

    const result = await userPreferenceService.getPreferences("user-1");
    expect(result).toEqual({});
  });

  it("updatePreferences sends patch request", async () => {
    (apiClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { autoSaveInterval: "5000" },
    });

    const result = await userPreferenceService.updatePreferences("user-1", { autoSaveInterval: "5000" });
    expect(result).toEqual({ autoSaveInterval: "5000" });
    expect(apiClient.patch).toHaveBeenCalledWith("/users/user-1/preferences", {
      preferences: { autoSaveInterval: "5000" },
    });
  });

  it("updatePreferences returns empty object on failure", async () => {
    (apiClient.patch as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      error: "error",
    });

    const result = await userPreferenceService.updatePreferences("user-1", {});
    expect(result).toEqual({});
  });
});
