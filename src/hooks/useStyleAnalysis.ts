import { useState, useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";
import { streamAi } from "@/services/aiService";
import { styleProfileService, type StyleProfile } from "@/services/styleProfileService";

export function useStyleAnalysis() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const chapters = useProjectStore((s) => s.chapters);
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!currentProject) return;
    const saved = await styleProfileService.getProfile(currentProject.id);
    setProfile(saved);
  }, [currentProject]);

  const analyzeStyle = useCallback(async (chapterIds?: string[]) => {
    if (!currentProject) return;
    setIsAnalyzing(true);
    setError(null);

    try {
      // Pick sample chapters: specified, or latest 3 done/writing chapters
      const sampleChapters = chapterIds
        ? chapters.filter((ch) => chapterIds.includes(ch.id))
        : [...chapters]
            .filter((ch) => ch.status === "done" || ch.status === "revised" || ch.status === "writing")
            .sort((a, b) => b.sortOrder - a.sortOrder)
            .slice(0, 3);

      if (sampleChapters.length === 0) {
        setError("没有可用于分析的章节");
        setIsAnalyzing(false);
        return;
      }

      const activeChapterId = sampleChapters[0]!.id;

      let result = "";
      for await (const event of streamAi({
        projectId: currentProject.id,
        skillId: "style-profile",
        chapterId: activeChapterId,
      })) {
        if (event.type === "chunk") result += event.content;
      }

      // Parse JSON from result
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        setError("AI 返回格式无法解析");
        setIsAnalyzing(false);
        return;
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        dimensions: StyleProfile["dimensions"];
        keywords: string[];
        summary: string;
      };

      const newProfile: StyleProfile = {
        dimensions: parsed.dimensions,
        keywords: parsed.keywords ?? [],
        summary: parsed.summary ?? "",
        lastAnalyzedAt: new Date().toISOString(),
        sampleChapterIds: sampleChapters.map((ch) => ch.id),
      };

      await styleProfileService.saveProfile(currentProject.id, newProfile);
      setProfile(newProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败");
    } finally {
      setIsAnalyzing(false);
    }
  }, [currentProject, chapters]);

  return { profile, isAnalyzing, error, loadProfile, analyzeStyle };
}
