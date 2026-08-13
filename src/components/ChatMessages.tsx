import { useState, useCallback } from 'react';
import { Loading, Button, Textarea, MessagePlugin } from 'tdesign-react';
import { ChatMarkdown } from '@tdesign-react/chat';
import { User, Bot, CheckCircle, RefreshCw, PencilLine, FileText, FileCheck2 } from 'lucide-react';
import { Message, Model, PermissionRequest, ContentBlock } from '../types';
import { getApiKey } from '../utils/apiKey';
import { ToolCallsCollapse } from './ToolCallsCollapse';
import { InlinePermissionCard } from './InlinePermissionCard';

interface ChatMessagesProps {
  messages: Message[];
  models: Model[];
  messagesEndRef: React.RefObject<HTMLDivElement>;
  permissionRequest?: PermissionRequest | null;
  onPermissionAllow?: () => void;
  onPermissionDeny?: () => void;
  onRegenerate?: (question: string) => void;
  onOpenKnowledge?: () => void;
}

// 回答交互按钮组件
function AnswerActions({ 
  question, 
  answer, 
  onRegenerate 
}: { 
  question: string; 
  answer: string; 
  onRegenerate?: (q: string) => void;
}) {
  const [saved, setSaved] = useState<'none' | 'accept' | 'learn'>('none');
  const [showLearnInput, setShowLearnInput] = useState(false);
  const [learnText, setLearnText] = useState('');
  const [saving, setSaving] = useState(false);

  // 采纳回答 → 写入 FAQ
  const handleAccept = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'accept_answer',
          question,
          answer,
          apiKey: getApiKey(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved('accept');
        MessagePlugin.success('已保存到 FAQ 知识库 ✅');
      } else {
        MessagePlugin.error(data.error || '保存失败');
      }
    } catch {
      MessagePlugin.error('网络错误，保存失败');
    } finally {
      setSaving(false);
    }
  }, [question, answer]);

  // 学习我的回答 → 写入案例库
  const handleLearn = useCallback(async () => {
    if (!learnText.trim()) {
      MessagePlugin.warning('请输入你的回答');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'learn_answer',
          question,
          userAnswer: learnText,
          apiKey: getApiKey(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved('learn');
        setShowLearnInput(false);
        MessagePlugin.success('你的回答已存入案例库 📝');
      } else {
        MessagePlugin.error(data.error || '保存失败');
      }
    } catch {
      MessagePlugin.error('网络错误，保存失败');
    } finally {
      setSaving(false);
    }
  }, [question, learnText]);

  if (saved !== 'none') {
    return (
      <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg" 
        style={{ backgroundColor: 'var(--td-success-color-light)' }}>
        <CheckCircle size={16} color="var(--td-success-color)" />
        <span className="text-sm" style={{ color: 'var(--td-success-color)' }}>
          {saved === 'accept' ? '已采纳并写入 FAQ' : '你的回答已存入案例库'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 mt-2">
      <div className="flex gap-2">
        <Button
          size="small"
          variant="outline"
          theme="success"
          icon={<CheckCircle size={14} />}
          loading={saving}
          onClick={handleAccept}
        >
          就这么回答
        </Button>
        <Button
          size="small"
          variant="outline"
          icon={<RefreshCw size={14} />}
          onClick={() => onRegenerate?.(question)}
        >
          重新回答
        </Button>
        <Button
          size="small"
          variant="outline"
          theme="warning"
          icon={<PencilLine size={14} />}
          onClick={() => setShowLearnInput(!showLearnInput)}
        >
          学习我的回答
        </Button>
      </div>
      
      {showLearnInput && (
        <div className="flex flex-col gap-2 mt-1">
          <Textarea
            value={learnText}
            onChange={(val) => setLearnText(val as string)}
            placeholder="输入你自己的回答，我会学习并存入案例库..."
            autosize={{ minRows: 3, maxRows: 8 }}
          />
          <div className="flex gap-2">
            <Button 
              size="small" 
              theme="primary"
              loading={saving}
              onClick={handleLearn}
            >
              保存到案例库
            </Button>
            <Button 
              size="small" 
              variant="text"
              onClick={() => { setShowLearnInput(false); setLearnText(''); }}
            >
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ChatMessages({ 
  messages, 
  models, 
  messagesEndRef,
  permissionRequest,
  onPermissionAllow,
  onPermissionDeny,
  onRegenerate,
  onOpenKnowledge,
}: ChatMessagesProps) {
  const formatModelName = (modelId: string) => {
    const model = models.find(m => m.modelId === modelId);
    const name = model?.name || modelId;
    return name
      .replace(/^(Claude|GPT|Gemini|Kimi|DeepSeek|Qwen|GLM)\s*/i, '')
      .replace(/-/g, ' ')
      .trim() || name;
  };

  // 渲染单个内容块
  const renderContentBlock = (block: ContentBlock, index: number, isStreaming?: boolean, isLast?: boolean) => {
    if (block.type === 'text') {
      return (
        <div 
          key={`text-${index}`}
          className="px-4 py-3 leading-relaxed break-words"
          style={{
            backgroundColor: 'var(--td-bg-color-component)',
            color: 'var(--td-text-color-primary)',
            borderRadius: '16px 16px 16px 4px'
          }}
        >
          <div className="chat-markdown">
            <ChatMarkdown content={block.text} />
          </div>
          {isStreaming && isLast && (
            <span 
              className="animate-cursor-blink ml-0.5"
              style={{ color: 'var(--td-brand-color)' }}
            >
              |
            </span>
          )}
        </div>
      );
    } else if (block.type === 'tool_use') {
      return (
        <ToolCallsCollapse
          key={`tool-${block.toolCall.id}`}
          toolCalls={[block.toolCall]}
          isStreaming={isStreaming && block.toolCall.status === 'running'}
        />
      );
    }
    return null;
  };

  // 渲染 assistant 消息内容
  const renderAssistantContent = (message: Message) => {
    if (message.contentBlocks && message.contentBlocks.length > 0) {
      return message.contentBlocks.map((block, index) => 
        renderContentBlock(block, index, message.isStreaming, index === message.contentBlocks!.length - 1)
      );
    }
    
    return (
      <>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <ToolCallsCollapse
            toolCalls={message.toolCalls}
            isStreaming={message.isStreaming}
          />
        )}
        {message.content && (
          <div 
            className="px-4 py-3 leading-relaxed break-words"
            style={{
              backgroundColor: 'var(--td-bg-color-component)',
              color: 'var(--td-text-color-primary)',
              borderRadius: '16px 16px 16px 4px'
            }}
          >
            <div className="chat-markdown">
              <ChatMarkdown content={message.content} />
            </div>
            {message.isStreaming && (
              <span 
                className="animate-cursor-blink ml-0.5"
                style={{ color: 'var(--td-brand-color)' }}
              >
                |
              </span>
            )}
          </div>
        )}
      </>
    );
  };

  // 查找 assistant 消息对应的用户问题
  const findQuestion = (assistantMsg: Message, allMessages: Message[]): string => {
    const idx = allMessages.findIndex(m => m.id === assistantMsg.id);
    // 往前找最近一条用户消息
    for (let i = idx - 1; i >= 0; i--) {
      if (allMessages[i].role === 'user') {
        return allMessages[i].content;
      }
    }
    return '';
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 max-w-3xl mx-auto">
      {messages.map((message, msgIndex) => (
        <div 
          key={message.id} 
          className={`flex gap-2 sm:gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
        >
          <div 
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center flex-shrink-0 rounded-full self-start"
            style={{
              backgroundColor: message.role === 'user' 
                ? 'var(--td-brand-color)' 
                : 'var(--td-bg-color-component)',
              color: message.role === 'user' 
                ? 'white' 
                : 'var(--td-text-color-primary)'
            }}
          >
            {message.role === 'user' ? <User size={18} /> : <Bot size={18} />}
          </div>
          <div 
            className={`flex flex-col gap-2 max-w-[85%] sm:max-w-[80%] ${message.role === 'user' ? 'items-end' : ''}`}
          >
            {message.role === 'assistant' && message.model && (
              <span 
                className="text-xs"
                style={{ color: 'var(--td-text-color-placeholder)' }}
              >
                {formatModelName(message.model)}
              </span>
            )}
            
            {/* 用户消息（含附件） */}
            {message.role === 'user' && (
              <div className="flex flex-col items-end gap-2 max-w-[85%] sm:max-w-[80%]">
                {message.attachments && message.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-end">
                    {message.attachments.map((a) =>
                      a.kind === 'image' ? (
                        <img
                          key={a.id}
                          src={a.dataUrl}
                          alt={a.name}
                          className="w-24 h-24 rounded-lg object-cover border"
                          style={{ borderColor: 'var(--td-component-stroke)' }}
                        />
                      ) : (
                        <div
                          key={a.id}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg"
                          style={{ backgroundColor: 'var(--td-brand-color)', color: '#fff' }}
                          title={a.name}
                        >
                          <FileText size={14} />
                          <span className="text-xs max-w-[160px] truncate">{a.name}</span>
                        </div>
                      )
                    )}
                  </div>
                )}
                {message.content && (
                  <div 
                    className="px-4 py-3 leading-relaxed break-words"
                    style={{
                      backgroundColor: 'var(--td-brand-color)',
                      color: 'white',
                      borderRadius: '16px 16px 4px 16px'
                    }}
                  >
                    {message.content}
                  </div>
                )}
              </div>
            )}
            
            {/* 助手消息 - 按顺序渲染内容块 */}
            {message.role === 'assistant' && renderAssistantContent(message)}
            
            {/* 回答完成后显示交互按钮 */}
            {message.role === 'assistant' && !message.isStreaming && message.content && (
              <AnswerActions
                question={findQuestion(message, messages)}
                answer={message.content}
                onRegenerate={onRegenerate}
              />
            )}

            {/* 已存入项目资料库提示 */}
            {message.role === 'assistant' && !message.isStreaming && message.savedFile && (
              <div
                className="flex items-center gap-2 mt-2 px-3 py-2 rounded-lg cursor-pointer hover:opacity-80"
                style={{ backgroundColor: 'var(--td-success-color-light)', color: 'var(--td-success-color)' }}
                onClick={() => onOpenKnowledge?.()}
                title="点击前往知识库查看"
              >
                <FileCheck2 size={16} />
                <span className="text-sm">
                  已存入项目资料库：{message.savedFile}（点击查看）
                </span>
              </div>
            )}
            
            {/* 思考中状态 */}
            {message.role === 'assistant' && message.isStreaming && 
             !message.content && 
             (!message.contentBlocks || message.contentBlocks.length === 0) && 
             (!message.toolCalls || message.toolCalls.length === 0) && (
              <div 
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--td-bg-color-component)' }}
              >
                <Loading size="small" />
                <span 
                  className="text-sm"
                  style={{ color: 'var(--td-text-color-secondary)' }}
                >
                  思考中...
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
      
      {/* 内联权限确认 */}
      {permissionRequest && onPermissionAllow && onPermissionDeny && (
        <div className="flex gap-3 ml-10 sm:ml-12">
          <InlinePermissionCard
            request={permissionRequest}
            onAllow={onPermissionAllow}
            onDeny={onPermissionDeny}
          />
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
}
