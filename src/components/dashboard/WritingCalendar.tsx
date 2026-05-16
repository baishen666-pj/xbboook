import { useState, useEffect, useCallback } from "react";
import { useProjectStore } from "@/stores/projectStore";

interface CalendarDay {
  date: string;
  words: number;
}

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];
const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

function getIntensity(words: number): number {
  if (words === 0) return 0;
  if (words < 500) return 1;
  if (words < 2000) return 2;
  if (words < 5000) return 3;
  return 4;
}

export function WritingCalendar() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const [year, setYear] = useState(new Date().getFullYear());
  const [days, setDays] = useState<Map<string, number>>(new Map());

  const fetchCalendar = useCallback(async () => {
    if (!currentProject) return;
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/checkins/calendar?year=${year}`);
      if (res.ok) {
        const data = await res.json();
        const map = new Map<string, number>();
        for (const d of data.data) {
          map.set(d.date, d.words_today);
        }
        setDays(map);
      }
    } catch { /* ignore */ }
  }, [currentProject, year]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  // Generate grid: 52 weeks x 7 days
  const startDate = new Date(year, 0, 1);
  const startDay = (startDate.getDay() + 6) % 7; // Monday = 0
  const firstDate = new Date(year, 0, 1 - startDay);

  const weeks: Array<Array<{ date: string; inYear: boolean }>> = [];
  let current = new Date(firstDate);

  for (let w = 0; w < 53; w++) {
    const week: Array<{ date: string; inYear: boolean }> = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = current.toISOString().slice(0, 10);
      week.push({ date: dateStr, inYear: current.getFullYear() === year });
      current = new Date(current.getTime() + 86400000);
    }
    weeks.push(week);
  }

  const intensityColors = [
    "var(--color-border)",
    "var(--color-primary)/30",
    "var(--color-primary)/50",
    "var(--color-primary)/75",
    "var(--color-primary)",
  ];

  const totalWords = Array.from(days.values()).reduce((s, w) => s + w, 0);
  const activeDays = Array.from(days.values()).filter((w) => w > 0).length;

  return (
    <div className="rounded-xl border border-[var(--color-border)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">写作日历</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear(year - 1)}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            &lt;
          </button>
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">{year}</span>
          <button
            onClick={() => setYear(year + 1)}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          >
            &gt;
          </button>
        </div>
      </div>

      <div className="flex gap-1 text-[10px] text-[var(--color-text-muted)]">
        <span className="shrink-0">{totalWords.toLocaleString()} 字 / {activeDays} 天</span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-[3px] min-w-fit">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day, di) => {
                const words = days.get(day.date) || 0;
                const intensity = day.inYear ? getIntensity(words) : 0;
                return (
                  <div
                    key={di}
                    title={`${day.date}: ${words} 字`}
                    className="w-[10px] h-[10px] rounded-sm"
                    style={{
                      backgroundColor:
                        intensity === 0
                          ? day.inYear
                            ? "var(--color-border)"
                            : "transparent"
                          : `color-mix(in srgb, var(--color-primary) ${intensity * 25}%, transparent)`,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-1 text-[10px] text-[var(--color-text-muted)]">
        <span>少</span>
        {intensityColors.map((_, i) => (
          <div
            key={i}
            className="w-[10px] h-[10px] rounded-sm"
            style={{
              backgroundColor:
                i === 0
                  ? "var(--color-border)"
                  : `color-mix(in srgb, var(--color-primary) ${i * 25}%, transparent)`,
            }}
          />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}
