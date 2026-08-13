import { useState, useCallback, useRef } from 'react';
import { Button, Input, Textarea, MessagePlugin, Dialog, Card, Tag, Space } from 'tdesign-react';
import { BookOpen, FileText, Plus, Trash, RefreshCw, Upload, FileUp, Edit } from 'lucide-react';
import { ChatMarkdown } from '@tdesign-react/chat';
import { useKnowledge } from '../hooks/useKnowledge';
import { useMediaQuery } from '../hooks/useMediaQuery';

export function KnowledgePage() {
  const {
    files, stats, loading, currentFile,
    fetchFiles, fetchStats, fetchFileContent, addContent, createFile, deleteFile, learnQA,
  } = useKnowledge();

  const isMobile = useMediaQuery('(max-width: 767px)');
  // 弹窗宽度：手机上取视口宽度的 90%（数字，tdesign Dialog 仅接受 number）
  const dialogWidth = (max: number) =>
    isMobile
      ? Math.min((typeof window !== 'undefined' ? window.innerWidth : 480) - 24, max)
      : max;

  const [viewingFile, setViewingFile] = useState<string | null>(null);
  const [viewDialog, setViewDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // 新增内容表单
  const [addForm, setAddForm] = useState({
    filename: '代理人FAQ.md',
    content: '',
    mode: 'append' as 'append' | 'overwrite',
  });
  
  // 创建文件表单
  const [createForm, setCreateForm] = useState({
    filename: '',
    content: '',
    description: '',
  });

  // 上传 .md 文件到知识库（同名覆盖，原样存档）
  const uploadMdRef = useRef<HTMLInputElement>(null);
  const handleUploadMd = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.md')) {
        MessagePlugin.warning(`已忽略非 .md 文件：${file.name}`);
        continue;
      }
      const text = await file.text();
      if (!text.trim()) {
        MessagePlugin.warning(`文件「${file.name}」内容为空`);
        continue;
      }
      // 同名覆盖写入知识库
      const result = await addContent(file.name, text, 'overwrite');
      if (result.success) {
        MessagePlugin.success(`已上传：${result.filename || file.name}`);
      } else {
        MessagePlugin.error(result.error || `上传失败：${file.name}`);
      }
    }
    e.target.value = '';
  }, [addContent]);

  const handleView = useCallback(async (filename: string) => {
    setViewingFile(filename);
    setViewDialog(true);
    await fetchFileContent(filename);
  }, [fetchFileContent]);

  const handleAdd = useCallback(async () => {
    if (!addForm.content.trim()) {
      MessagePlugin.warning('内容不能为空');
      return;
    }
    const result = await addContent(addForm.filename, addForm.content, addForm.mode);
    if (result.success) {
      MessagePlugin.success(result.message || '添加成功');
      setShowAddDialog(false);
      setAddForm({ ...addForm, content: '' });
    } else {
      MessagePlugin.error(result.error || '添加失败');
    }
  }, [addForm, addContent]);

  const handleCreate = useCallback(async () => {
    if (!createForm.filename.trim()) {
      MessagePlugin.warning('文件名不能为空');
      return;
    }
    const result = await createFile(createForm.filename, createForm.content, createForm.description);
    if (result.success) {
      MessagePlugin.success(result.message || '创建成功');
      setShowCreateDialog(false);
      setCreateForm({ filename: '', content: '', description: '' });
    } else {
      MessagePlugin.error(result.error || '创建失败');
    }
  }, [createForm, createFile]);

  // 点删除 → 先弹确认，不直接删
  const handleDeleteClick = useCallback((filename: string) => {
    setDeleteTarget(filename);
  }, []);

  // 确认后才真正删除
  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const result = await deleteFile(target);
    if (result.success) {
      MessagePlugin.success(result.message || '删除成功');
      if (viewingFile === target) {
        setViewDialog(false);
        setViewingFile(null);
      }
    } else {
      MessagePlugin.error(result.error || '删除失败');
    }
    setDeleteTarget(null);
  }, [deleteFile, deleteTarget, viewingFile]);

  // 从卡片直接进入编辑：打开弹窗并加载内容后切到编辑态
  const handleEditClick = useCallback(async (filename: string) => {
    setViewingFile(filename);
    setViewDialog(true);
    setEditMode(false);
    const data = await fetchFileContent(filename);
    if (data && data.content !== undefined) {
      setEditContent(data.content);
      setEditMode(true);
    }
  }, [fetchFileContent]);

  // 在查看弹窗内点"编辑"：把当前内容载入编辑框
  const handleEdit = useCallback(() => {
    if (currentFile) {
      setEditContent(currentFile.content);
      setEditMode(true);
    }
  }, [currentFile]);

  // 保存编辑：整文件覆盖写回知识库
  const handleSaveEdit = useCallback(async () => {
    if (!viewingFile) return;
    setSaving(true);
    const result = await addContent(viewingFile, editContent, 'overwrite');
    if (result.success) {
      MessagePlugin.success('已保存修改');
      setEditMode(false);
      await fetchFileContent(viewingFile);
      await fetchFiles();
      await fetchStats();
    } else {
      MessagePlugin.error(result.error || '保存失败');
    }
    setSaving(false);
  }, [viewingFile, editContent, addContent, fetchFileContent, fetchFiles, fetchStats]);

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    setEditMode(false);
    setEditContent('');
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { 
      month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto">
        {/* 标题栏 */}
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BookOpen size={28} color="var(--td-brand-color)" />
            <div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--td-text-color-primary)' }}>
                知识库管理
              </h2>
              <p className="text-sm" style={{ color: 'var(--td-text-color-secondary)' }}>
                管理底层知识，Agent 会自动检索这些文件来回答问题
              </p>
            </div>
          </div>
          <Space>
            <Button 
              icon={<RefreshCw size={16} />} 
              variant="text"
              onClick={() => { fetchFiles(); }}
              loading={loading}
            >
              刷新
            </Button>
            <Button 
              icon={<Plus size={16} />}
              onClick={() => setShowAddDialog(true)}
            >
              追加内容
            </Button>
            <Button 
              icon={<Upload size={16} />}
              variant="outline"
              onClick={() => setShowCreateDialog(true)}
            >
              新建文件
            </Button>
            <Button 
              icon={<FileUp size={16} />}
              theme="primary"
              onClick={() => uploadMdRef.current?.click()}
            >
              上传MD文件
            </Button>
          </Space>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--td-brand-color)' }}>
                {stats.totalFiles}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--td-text-color-secondary)' }}>
                知识文件
              </div>
            </Card>
            <Card className="text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--td-success-color)' }}>
                {stats.totalLines}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--td-text-color-secondary)' }}>
                总行数
              </div>
            </Card>
            <Card className="text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--td-warning-color)' }}>
                {(stats.totalWords / 1000).toFixed(1)}k
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--td-text-color-secondary)' }}>
                总字数
              </div>
            </Card>
            <Card className="text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--td-error-color)' }}>
                {formatSize(stats.totalSize)}
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--td-text-color-secondary)' }}>
                总大小
              </div>
            </Card>
          </div>
        )}

        {/* 文件列表 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {files.map(file => (
            <div
              key={file.filename}
              className="cursor-pointer hover:shadow-lg transition-shadow rounded-lg"
              onClick={() => handleView(file.filename)}
            >
              <Card
                header={
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={18} color="var(--td-brand-color)" />
                      <span
                        className="font-medium truncate"
                        title={file.filename}
                        style={{ color: 'var(--td-text-color-primary)' }}
                      >
                        {file.filename}
                      </span>
                    </div>
                    <Button
                      theme="primary"
                      variant="text"
                      size="small"
                      icon={<Edit size={14} />}
                      onClick={(e) => {
                        e?.stopPropagation?.();
                        handleEditClick(file.filename);
                      }}
                    >
                      编辑
                    </Button>
                    <Button
                      theme="danger"
                      variant="text"
                      size="small"
                      icon={<Trash size={14} />}
                      onClick={(e) => {
                        e?.stopPropagation?.();
                        handleDeleteClick(file.filename);
                      }}
                    >
                      删除
                    </Button>
                  </div>
                }
              >
                <div className="flex items-center gap-3 mb-2">
                  <Tag size="small" theme="primary">{file.lineCount} 行</Tag>
                  <Tag size="small" theme="success">{formatSize(file.size)}</Tag>
                  <Tag size="small" theme="warning">{formatDate(file.updatedAt)}</Tag>
                </div>
                <p className="text-xs line-clamp-2" style={{ color: 'var(--td-text-color-secondary)' }}>
                  {file.preview}
                </p>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* 文件内容查看 / 编辑（弹窗） */}
      <Dialog
        visible={viewDialog}
        title={currentFile ? currentFile.filename : '查看文件'}
        onClose={() => { setViewDialog(false); setEditMode(false); setEditContent(''); }}
        footer={null}
        width={dialogWidth(760)}
      >
        {!editMode ? (
          <div
            className="chat-markdown"
            style={{
              maxHeight: '60vh',
              overflowY: 'auto',
              padding: '12px 16px',
              backgroundColor: 'var(--td-bg-color-component)',
              borderRadius: '8px',
            }}
          >
            {currentFile ? <ChatMarkdown content={currentFile.content} /> : '加载中…'}
          </div>
        ) : (
          <Textarea
            value={editContent}
            onChange={(val) => setEditContent(val as string)}
            autosize={{ minRows: 20, maxRows: 30 }}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px' }}
          />
        )}
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {!editMode ? (
            <Button theme="primary" icon={<Edit size={16} />} onClick={handleEdit}>
              编辑
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleCancelEdit}
                disabled={saving}
              >
                取消
              </Button>
              <Button
                theme="primary"
                onClick={handleSaveEdit}
                loading={saving}
              >
                保存修改
              </Button>
            </>
          )}
        </div>
      </Dialog>

      {/* 删除确认 */}
      <Dialog
        visible={!!deleteTarget}
        title="删除确认"
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        confirmBtn={{ content: '确认删除', theme: 'danger' }}
        cancelBtn="取消"
        width={dialogWidth(440)}
      >
        <p style={{ color: 'var(--td-text-color-primary)' }}>
          确定要删除「<strong>{deleteTarget}</strong>」吗？此操作不可恢复，删除后知识库将不再包含该文件。
        </p>
      </Dialog>

      {/* 追加内容弹窗 */}
      <Dialog
        visible={showAddDialog}
        title="追加知识内容"
        onClose={() => setShowAddDialog(false)}
        onConfirm={handleAdd}
        width={dialogWidth(600)}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">目标文件</label>
            <Input
              value={addForm.filename}
              onChange={(val) => setAddForm({ ...addForm, filename: val as string })}
              placeholder="如：代理人FAQ.md"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">写入模式</label>
            <Space>
              <Button
                size="small"
                variant={addForm.mode === 'append' ? 'base' : 'outline'}
                theme={addForm.mode === 'append' ? 'primary' : 'default'}
                onClick={() => setAddForm({ ...addForm, mode: 'append' })}
              >
                追加到末尾
              </Button>
              <Button
                size="small"
                variant={addForm.mode === 'overwrite' ? 'base' : 'outline'}
                theme={addForm.mode === 'overwrite' ? 'primary' : 'default'}
                onClick={() => setAddForm({ ...addForm, mode: 'overwrite' })}
              >
                覆盖整个文件
              </Button>
            </Space>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">内容（支持 Markdown）</label>
            <Textarea
              value={addForm.content}
              onChange={(val) => setAddForm({ ...addForm, content: val as string })}
              placeholder="粘贴要添加的知识内容..."
              autosize={{ minRows: 6, maxRows: 15 }}
            />
          </div>
        </div>
      </Dialog>

      {/* 创建新文件弹窗 */}
      <Dialog
        visible={showCreateDialog}
        title="创建知识库文件"
        onClose={() => setShowCreateDialog(false)}
        onConfirm={handleCreate}
        width={dialogWidth(600)}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">文件名（自动加 .md 后缀）</label>
            <Input
              value={createForm.filename}
              onChange={(val) => setCreateForm({ ...createForm, filename: val as string })}
              placeholder="如：新项目资料"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">描述</label>
            <Input
              value={createForm.description}
              onChange={(val) => setCreateForm({ ...createForm, description: val as string })}
              placeholder="文件用途说明"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">初始内容（支持 Markdown）</label>
            <Textarea
              value={createForm.content}
              onChange={(val) => setCreateForm({ ...createForm, content: val as string })}
              placeholder="粘贴文件内容..."
              autosize={{ minRows: 6, maxRows: 15 }}
            />
          </div>
        </div>
      </Dialog>

      {/* 上传 .md 文件（隐藏 input） */}
      <input
        ref={uploadMdRef}
        type="file"
        multiple
        accept=".md"
        className="hidden"
        onChange={handleUploadMd}
      />
    </div>
  );
}
