import { useState } from 'react';
import { Input, Button, MessagePlugin } from 'tdesign-react';
import { Key, ExternalLink } from 'lucide-react';
import { setApiKey } from '../utils/apiKey';

interface ApiKeyGateProps {
  onSaved: () => void;
}

export function ApiKeyGate({ onSaved }: ApiKeyGateProps) {
  const [key, setKey] = useState('');
  const [validating, setValidating] = useState(false);

  const handleSave = async () => {
    const trimmed = key.trim();
    if (!trimmed) {
      MessagePlugin.warning('请输入你的千问 / DashScope API Key');
      return;
    }

    setValidating(true);
    try {
      // 调用后端验证 Key 是否有效
      const res = await fetch('/api/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed }),
      });
      const data = await res.json();

      if (!res.ok || !data.valid) {
        MessagePlugin.error(data.error || 'API Key 无效，请检查后重试');
        return;
      }

      // 验证通过，保存到 localStorage
      setApiKey(trimmed);
      MessagePlugin.success('API Key 验证成功！');
      onSaved();
    } catch (error: any) {
      MessagePlugin.error('验证失败：' + (error?.message || '网络错误'));
    } finally {
      setValidating(false);
    }
  };

  return (
    <div
      className="flex items-center justify-center h-screen w-screen"
      style={{ backgroundColor: 'var(--td-bg-color-page)' }}
    >
      <div
        className="w-full max-w-md p-8 rounded-2xl"
        style={{
          backgroundColor: 'var(--td-bg-color-container)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}
      >
        {/* Logo / Title */}
        <div className="text-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ backgroundColor: '#0052d9' }}
          >
            <Key size={32} style={{ color: 'white' }} />
          </div>
          <h1
            className="text-xl font-semibold"
            style={{ color: 'var(--td-text-color-primary)' }}
          >
            欢迎使用 Greta 问答助手
          </h1>
          <p
            className="text-sm mt-2"
            style={{ color: 'var(--td-text-color-secondary)' }}
          >
            首次使用请输入你自己的千问 / DashScope API Key
          </p>
        </div>

        {/* 说明 */}
        <div
          className="p-4 rounded-lg mb-5 text-sm"
          style={{ backgroundColor: 'var(--td-bg-color-component)' }}
        >
          <p style={{ color: 'var(--td-text-color-secondary)' }} className="mb-2">
            <strong>什么是 API Key？</strong>
          </p>
          <p style={{ color: 'var(--td-text-color-secondary)' }}>
            就像一张通行证，你用自己的 Key，AI 回答消耗的就是你自己的积分，和别人互不影响。
          </p>
          <p style={{ color: 'var(--td-text-color-secondary)' }} className="mt-3">
            <strong>怎么获取？</strong>
          </p>
          <p style={{ color: 'var(--td-text-color-secondary)' }}>
            1. 打开{' '}
            <a
              href="https://dashscope.console.aliyun.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--td-brand-color)' }}
            >
              dashscope.aliyun.com
              <ExternalLink size={14} style={{ verticalAlign: 'middle', marginLeft: '2px' }} />
            </a>
            <br />
            2. 注册 / 登录你的账号
            <br />
            3. 找到「API Key」页面，创建一个 Key
            <br />
            4. 复制后粘贴到下方输入框
          </p>
        </div>

        {/* 输入框 */}
        <div className="mb-4">
          <Input
            type="password"
            size="large"
            value={key}
            onChange={(v) => setKey(v as string)}
            placeholder="粘贴你的千问 / DashScope API Key"
            onEnter={handleSave}
          />
        </div>

        {/* 按钮 */}
        <Button
          theme="primary"
          size="large"
          block
          onClick={handleSave}
          loading={validating}
          disabled={!key.trim()}
        >
          {validating ? '正在验证...' : '验证并进入'}
        </Button>

        <p
          className="text-xs text-center mt-4"
          style={{ color: 'var(--td-text-color-placeholder)' }}
        >
          你的 Key 只保存在你的浏览器中，不会上传到服务器存储
        </p>
      </div>
    </div>
  );
}
