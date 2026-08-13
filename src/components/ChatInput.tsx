import { useRef, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Select } from 'tdesign-react';
import { ChevronDownIcon } from 'tdesign-icons-react';
import { Paperclip, FileText, X, Send, Square } from 'lucide-react';
import { Model, PermissionMode, Attachment, ChatSendPayload } from '../types';

interface ChatInputProps {
  inputValue: string;
  selectedModel: string;
  models: Model[];
  isLoading: boolean;
  permissionMode: PermissionMode;
  onSend: (payload: ChatSendPayload) => void;
  onStop: () => void;
  onChange: (value: string) => void;
  onModelChange: (modelId: string) => void;
  onPermissionModeChange: (mode: PermissionMode) => void;
}

export function ChatInput({
  inputValue,
  selectedModel,
  models,
  isLoading,
  onSend,
  onStop,
  onChange,
  onModelChange,
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // 真正的发送动作（原生按钮 / 回车都会调用，100% 可靠触发）
  const doSend = useCallback(() => {
    const text = (inputValue || '').trim();
    if ((!text && attachments.length === 0) || isLoading) return;
    onSend({ message: text, attachments });
    setAttachments([]);
    onChange('');
    // 重置 textarea 高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [inputValue, attachments, isLoading, onSend, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 回车发送，Shift+回车换行；输入法 composing 时不触发
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      doSend();
    }
  }, [doSend]);

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    // 自动调高
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  }, [onChange]);

  // 选择文件 / 图片（仅接受图片与 .md 项目资料）
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith('image/');
      const isMd = file.name.toLowerCase().endsWith('.md');
      if (!isImage && !isMd) {
        console.warn('已忽略不支持的文件（仅支持图片与 .md）：', file.name);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const kind: 'image' | 'file' = isImage ? 'image' : 'file';
        setAttachments((prev) => [
          ...prev,
          { id: uuidv4(), kind, name: file.name, dataUrl, size: file.size },
        ]);
        if (!inputValue.trim()) {
          const hint = kind === 'image'
            ? '请帮我看看这张图'
            : '这份项目资料已自动存入知识库，请帮我梳理要点';
          onChange(hint);
        }
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  }, [inputValue, onChange]);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const canSend = selectedModel && (inputValue.trim() || attachments.length > 0) && !isLoading;

  return (
    <div className="px-3 pb-4 pt-3 sm:px-4 sm:pb-6 sm:pt-4" style={{ backgroundColor: 'var(--td-bg-color-page)' }}>
      <div className="max-w-3xl mx-auto">
        {/* 附件预览区 */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg border"
                style={{
                  backgroundColor: 'var(--td-bg-color-component)',
                  borderColor: 'var(--td-component-stroke)',
                }}
              >
                {a.kind === 'image' ? (
                  <img src={a.dataUrl} alt={a.name} className="w-8 h-8 rounded object-cover" />
                ) : (
                  <FileText size={16} color="var(--td-brand-color)" />
                )}
                <span
                  className="text-xs max-w-[140px] truncate"
                  style={{ color: 'var(--td-text-color-primary)' }}
                  title={a.kind === 'file' ? `${a.name}（将自动存入项目资料库）` : a.name}
                >
                  {a.name}
                </span>
                <button
                  onClick={() => removeAttachment(a.id)}
                  className="rounded-full p-0.5 hover:opacity-70"
                  style={{ color: 'var(--td-text-color-placeholder)' }}
                  aria-label="移除附件"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 输入框容器 */}
        <div
          className="rounded-2xl flex flex-col"
          style={{
            backgroundColor: 'var(--td-bg-color-page)',
            boxShadow: 'none',
          }}
        >
          {/* 原生 textarea：onChange / onKeyDown 100% 可靠触发 */}
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="输入消息，回车发送 / Shift+回车换行；点左下回形针可发送截图或项目资料（.md）..."
            rows={1}
            disabled={!selectedModel}
            className="w-full resize-none bg-transparent outline-none px-4 pt-3 pb-2 text-sm leading-relaxed"
            style={{ color: 'var(--td-text-color-primary)', maxHeight: 200, minHeight: 44, border: 'none' }}
          />

          {/* 工具栏 */}
          <div className="flex items-center justify-between gap-2 px-3 pb-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center rounded-md p-1 hover:opacity-70 flex-shrink-0"
                style={{
                  color: 'var(--td-text-color-secondary)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                title="发送截图或项目资料（.md）"
              >
                <Paperclip size={18} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.md"
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* 模型选择器 */}
              <Select
                value={selectedModel}
                onChange={(value) => onModelChange(value as string)}
                placeholder="选择模型"
                size="small"
                className="min-w-0 flex-1 sm:flex-none sm:w-[220px]"
                filterable
                borderless
                suffixIcon={<ChevronDownIcon />}
              >
                {models.map(model => (
                  <Select.Option key={model.modelId} value={model.modelId} label={model.name} />
                ))}
              </Select>
            </div>

            {/* 发送 / 停止按钮 */}
            {isLoading ? (
              <button
                onClick={onStop}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg"
                style={{
                  backgroundColor: 'var(--td-error-color)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Square size={14} fill="#fff" />
                <span className="text-sm">停止</span>
              </button>
            ) : (
              <button
                onClick={doSend}
                disabled={!canSend}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg transition-opacity"
                style={{
                  backgroundColor: canSend ? 'var(--td-brand-color)' : 'var(--td-bg-color-disabled)',
                  color: canSend ? '#fff' : 'var(--td-text-color-disabled)',
                  border: 'none',
                  cursor: canSend ? 'pointer' : 'not-allowed',
                }}
              >
                <Send size={14} />
                <span className="text-sm">发送</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
