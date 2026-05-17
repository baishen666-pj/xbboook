import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const STEPS = [
  { title: "快速设置（可选）", description: "帮你快速搭建项目框架，也可以稍后在编辑器中设置" },
  { title: "创建主角", description: "添加你故事的主角" },
  { title: "准备就绪！", description: "你已经准备好开始写作了" },
];

export function OnboardingWizard({ isOpen, onClose, onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [charName, setCharName] = useState("");
  const [charGender, setCharGender] = useState("男");
  const [charPersonality, setCharPersonality] = useState("");

  function handleFinish() {
    // Could save character data here via API
    onComplete();
  }

  function handleSkip() {
    onComplete();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={STEPS[step]?.title ?? ""}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          {STEPS[step]?.description}
        </p>

        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        {step === 0 && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 text-xs text-[var(--color-text-muted)] space-y-2">
            <p>Xbboook 提供以下核心功能：</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong className="text-[var(--color-text-secondary)]">富文本编辑器</strong> — 支持 Markdown 快捷输入、分屏对照</li>
              <li><strong className="text-[var(--color-text-secondary)]">AI 写作助手</strong> — 24 种技能，续写、润色、角色对话</li>
              <li><strong className="text-[var(--color-text-secondary)]">角色 & 世界观</strong> — 管理角色设定、关系图谱、世界设定</li>
              <li><strong className="text-[var(--color-text-secondary)]">伏笔追踪</strong> — 埋设和回收伏笔，保持故事连贯</li>
              <li><strong className="text-[var(--color-text-secondary)]">版本管理</strong> — 自动快照，随时回滚</li>
            </ul>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <Input
              label="主角名字"
              placeholder="例如：林逸"
              value={charName}
              onChange={(e) => setCharName(e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[var(--color-text-secondary)]">性别</label>
              <div className="flex gap-2">
                {["男", "女", "其他"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setCharGender(g)}
                    className={[
                      "flex-1 rounded-md border px-3 py-2 text-sm transition-colors",
                      charGender === g
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                        : "border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]",
                    ].join(" ")}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-[var(--color-text-secondary)]">性格描述</label>
              <textarea
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]"
                rows={2}
                placeholder="例如：表面懒散，内心坚韧，重情重义"
                value={charPersonality}
                onChange={(e) => setCharPersonality(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="rounded-lg border border-[var(--color-success)]/20 bg-[var(--color-success)]/5 p-4 text-center">
            <p className="text-sm text-[var(--color-success)] font-medium">一切就绪！</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              左侧面板管理章节、角色和大纲，右侧面板是 AI 助手。
              <br />
              按 <kbd className="rounded bg-[var(--color-surface-2)] px-1 py-0.5 text-[10px]">F11</kbd> 进入专注模式，
              <kbd className="rounded bg-[var(--color-surface-2)] px-1 py-0.5 text-[10px]">Ctrl+S</kbd> 保存。
            </p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={handleSkip} type="button">
            跳过
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)} type="button">
                上一步
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button variant="primary" onClick={() => setStep(step + 1)} type="button">
                下一步
              </Button>
            ) : (
              <Button variant="primary" onClick={handleFinish} type="button">
                开始写作
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
