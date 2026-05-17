// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { chapterVersionService } from '@/services/chapterVersionService';

interface Props {
  projectId: string;
  chapterId?: string;
}

export function VersionHistoryPanel({ projectId, chapterId }: Props) {
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [diffResult, setDiffResult] = useState<any>(null);
  const [previewVersion, setPreviewVersion] = useState<any>(null);
  const [rollbackConfirm, setRollbackConfirm] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    const res = await chapterVersionService.list(projectId, chapterId);
    if (res.success && res.data) setVersions(res.data);
    setLoading(false);
  }, [projectId, chapterId]);

  useEffect(() => { void loadVersions(); }, [loadVersions]);

  const handleCreateSnapshot = async () => {
    if (!chapterId) return;
    const res = await chapterVersionService.create(projectId, { chapterId, type: 'manual' });
    if (res.success) await loadVersions();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
    setDiffResult(null);
  };

  const handleDiff = async () => {
    if (selectedIds.length !== 2) return;
    const res = await chapterVersionService.diff(projectId, selectedIds[0], selectedIds[1]);
    if (res.success && res.data) setDiffResult(res.data);
  };

  const handleRollback = async (id: string) => {
    const res = await chapterVersionService.rollback(projectId, id);
    if (res.success) {
      setRollbackConfirm(null);
      await loadVersions();
    }
  };

  const handlePreview = async (id: string) => {
    if (previewVersion?.id === id) { setPreviewVersion(null); return; }
    const res = await chapterVersionService.get(projectId, id);
    if (res.success && res.data) setPreviewVersion(res.data);
  };

  const typeIcons: Record<string, string> = { manual: '📌', auto: '🔄', milestone: '🏆' };
  const typeColors: Record<string, string> = { manual: '#3b82f6', auto: '#6b7280', milestone: '#f59e0b' };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>📜 版本历史</h3>
        {chapterId && (
          <button onClick={handleCreateSnapshot} style={{
            padding: '6px 12px', borderRadius: 6, border: '1px solid #6366f1', background: '#eef2ff',
            fontSize: 12, cursor: 'pointer', fontWeight: 500,
          }}>📌 创建快照</button>
        )}
      </div>

      {loading && <div style={{ fontSize: 13, color: '#888' }}>加载中...</div>}

      {/* Version list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {versions.map((v, i) => (
          <div key={v.id} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
            background: selectedIds.includes(v.id) ? '#eef2ff' : '#f8fafc',
            border: selectedIds.includes(v.id) ? '1px solid #6366f1' : '1px solid transparent',
            borderRadius: 6, fontSize: 12, cursor: 'pointer',
          }} onClick={() => toggleSelect(v.id)}>
            <span style={{ fontSize: 16 }}>{typeIcons[v.snapshot_type] || '📄'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{v.title}</div>
              <div style={{ color: '#888', fontSize: 11 }}>
                {new Date(v.created_at).toLocaleString('zh-CN')} · {v.word_count} 字
                <span style={{ marginLeft: 8, color: typeColors[v.snapshot_type] || '#888' }}>
                  {{ manual: '手动', auto: '自动', milestone: '里程碑' }[v.snapshot_type] || v.snapshot_type}
                </span>
              </div>
              {v.note && <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>{v.note}</div>}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={(e) => { e.stopPropagation(); handlePreview(v.id); }} style={{
                padding: '2px 8px', borderRadius: 4, border: '1px solid #ddd', background: '#fff',
                fontSize: 11, cursor: 'pointer',
              }}>预览</button>
              <button onClick={(e) => { e.stopPropagation(); setRollbackConfirm(v.id); }} style={{
                padding: '2px 8px', borderRadius: 4, border: '1px solid #fca5a5', background: '#fef2f2',
                fontSize: 11, cursor: 'pointer', color: '#dc2626',
              }}>回滚</button>
            </div>
          </div>
        ))}
        {versions.length === 0 && !loading && <div style={{ fontSize: 13, color: '#888', textAlign: 'center', padding: 20 }}>暂无版本记录</div>}
      </div>

      {/* Diff button */}
      {selectedIds.length === 2 && (
        <button onClick={handleDiff} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none', background: '#6366f1',
          color: '#fff', fontWeight: 500, cursor: 'pointer',
        }}>🔍 对比选中版本</button>
      )}

      {/* Diff result */}
      {diffResult && (
        <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, fontSize: 12 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>📊 版本对比</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div style={{ padding: 8, background: '#fff', borderRadius: 4 }}>
              <div style={{ fontWeight: 500 }}>{diffResult.snapshot1.title}</div>
              <div style={{ color: '#888' }}>{diffResult.snapshot1.word_count} 字</div>
            </div>
            <div style={{ padding: 8, background: '#fff', borderRadius: 4 }}>
              <div style={{ fontWeight: 500 }}>{diffResult.snapshot2.title}</div>
              <div style={{ color: '#888' }}>{diffResult.snapshot2.word_count} 字</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ color: '#16a34a' }}>+{diffResult.added_lines} 行新增</span>
            <span style={{ color: '#dc2626' }}>-{diffResult.removed_lines} 行删除</span>
          </div>
        </div>
      )}

      {/* Preview */}
      {previewVersion && (
        <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <h4 style={{ margin: 0, fontSize: 14 }}>📖 {previewVersion.title}</h4>
            <button onClick={() => setPreviewVersion(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.8, maxHeight: 300, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
            {previewVersion.content?.slice(0, 2000)}{previewVersion.content?.length > 2000 ? '...' : ''}
          </div>
        </div>
      )}

      {/* Rollback confirmation */}
      {rollbackConfirm && (
        <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8 }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>⚠️ 确认回滚到此版本？当前内容将自动创建备份快照。</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleRollback(rollbackConfirm)} style={{
              padding: '6px 12px', borderRadius: 6, border: 'none', background: '#dc2626',
              color: '#fff', fontWeight: 500, cursor: 'pointer',
            }}>确认回滚</button>
            <button onClick={() => setRollbackConfirm(null)} style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid #ddd', background: '#fff',
              cursor: 'pointer',
            }}>取消</button>
          </div>
        </div>
      )}
    </div>
  );
}
