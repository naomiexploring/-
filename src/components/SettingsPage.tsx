import { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Textarea,
  Button,
  Tooltip,
  Popconfirm,
  MessagePlugin,
  Link,
  Select
} from 'tdesign-react';
import {
  AddIcon,
  EditIcon,
  DeleteIcon,
  CheckIcon,
  CheckCircleFilledIcon,
  CloseCircleFilledIcon
} from 'tdesign-icons-react';
import { Bot, Sparkles, Code, FileText, Globe, Lightbulb, Key, ExternalLink } from 'lucide-react';
import { CustomAgent, PermissionMode } from '../types';
import { getApiKey, setApiKey, clearApiKey, maskApiKey } from '../utils/apiKey';

interface SettingsPageProps {
  agents: CustomAgent[];
  onAdd: (agent: Omit<CustomAgent, 'id' | 'createdAt' | 'updatedAt'>) => CustomAgent;
  onUpdate: (id: string, updates: Partial<Omit<CustomAgent, 'id' | 'createdAt'>>) => void;
  onDelete: (id: string) => void;
  onApiKeyCleared?: () => void;
}

const PRESET_ICONS = [
  { name: 'Bot', icon: Bot },
  { name: 'Sparkles', icon: Sparkles },
  { name: 'Code', icon: Code },
  { name: 'FileText', icon: FileText },
  { name: 'Globe', icon: Globe },
  { name: 'Lightbulb', icon: Lightbulb },
];

const PRESET_COLORS = [
  '#0052d9', '#0594fa', '#00a870', '#ed7b2f', 
  '#e34d59', '#a25eb5', '#5c6bc0', '#26a69a'
];

const PERMISSION_MODES: { value: PermissionMode; label: string; description: string }[] = [
  { value: 'default', label: 'default', description: '默认模式，所有操作需确认' },
  { value: 'acceptEdits', label: 'acceptEdits', description: '自动批准文件编辑，Bash 仍需确认' },
  { value: 'plan', label: 'plan', description: '规划模式，仅允许读取操作' },
  { value: 'bypassPermissions', label: 'bypassPermissions', description: '跳过所有权限检查（谨慎使用）' },
];

const PRESET_TEMPLATES = [
  {
    name: 'Greta 问答助手',
    description: '活动运营 owner 风格，回答代理人关于 Care Plus 活动的问题',
    systemPrompt: `你是 Greta（籽籽），大都会人寿的活动/产品运营 owner，负责对接一线保险代理人。

## 核心身份
你对接的代理人在使用 iAgent 平台的 Care Plus 客户互动活动。你的职责是回答他们关于活动操作、规则、报错、领取等方面的疑问，风格亲切、口语化、像搭档一样。

## 知识库
工作目录下有 knowledge-base/ 文件夹，包含 FAQ、案例库、风格规范等文件，回答前务必先检索。检索优先级：项目资料库 > FAQ库 > 案例库。

## 回答风格规范
1. 称呼用户用"你"，语气亲切、口语化、轻松，大量使用 emoji（😌🧐🤭🙏🏻👌）
2. 结构：结论先行 → 给路径/步骤 → 必要时派活带 SOP → 结尾推一个动作
3. 短答 1-3 句；派活类可到半屏，用换行分步
4. 固定术语：始终称"代理人"而非"代理"；称"礼遇"而非"福利/奖品"；称"关爱名单"而非"客户列表"
5. 禁止出现"作为AI""很高兴为您服务"等套话`,
    icon: 'Sparkles',
    color: '#0594fa',
  },
  {
    name: 'FAQ 快速查询',
    description: '简洁回答代理人常见问题，不带情感色彩',
    systemPrompt: `你是一个 FAQ 查询助手，基于 knowledge-base/ 目录中的 代理人FAQ.md 回答问题。

要求：
- 回答简洁、准确，先给结论再展开
- 涉及操作路径时用箭头标注（如 iAgent 首页 👈 Care Plus）
- 如果知识库中没有相关内容，明确告知"知识库中暂无此问题的答案"
- 使用简体中文`,
    icon: 'FileText',
    color: '#00a870',
  },
  {
    name: '代码助手',
    description: '专注于编程和代码相关任务',
    systemPrompt: '你是一个专业的编程助手。你擅长编写、审查和解释代码。请提供清晰、高效且符合最佳实践的代码解决方案。在解释时，请考虑代码的可读性、性能和可维护性。',
    icon: 'Code',
    color: '#ed7b2f',
  },
  {
    name: '写作助手',
    description: '帮助撰写和优化各类文档',
    systemPrompt: '你是一个专业的写作助手。你擅长撰写、编辑和优化各类文档，包括文章、报告、邮件等。请帮助用户提升文字表达的清晰度、逻辑性和吸引力。',
    icon: 'FileText',
    color: '#a25eb5',
  },
];

export function SettingsPage({
  agents,
  onAdd,
  onUpdate,
  onDelete,
  onApiKeyCleared,
}: SettingsPageProps) {
  const [editingAgent, setEditingAgent] = useState<CustomAgent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    icon: 'Bot',
    color: '#0052d9',
    permissionMode: 'default' as PermissionMode,
  });
  
  // API Key 管理（用户自管，存在 localStorage）
  const [currentKey, setCurrentKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [validating, setValidating] = useState(false);

  // 初始化时读取已保存的 API Key
  useEffect(() => {
    setCurrentKey(getApiKey());
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      systemPrompt: '',
      icon: 'Bot',
      color: '#0052d9',
      permissionMode: 'default',
    });
    setEditingAgent(null);
    setIsCreating(false);
  };

  const handleEdit = (agent: CustomAgent) => {
    if (agent.id === 'default') return;
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      description: agent.description || '',
      systemPrompt: agent.systemPrompt,
      icon: agent.icon || 'Bot',
      color: agent.color || '#0052d9',
      permissionMode: agent.permissionMode || 'default',
    });
    setIsCreating(true);
  };

  const handleSave = () => {
    if (!formData.name.trim() || !formData.systemPrompt.trim()) {
      MessagePlugin.warning('请填写名称和系统提示词');
      return;
    }

    if (editingAgent) {
      onUpdate(editingAgent.id, formData);
      MessagePlugin.success('Agent 已更新');
    } else {
      onAdd(formData);
      MessagePlugin.success('Agent 已创建');
    }
    resetForm();
  };

  const handleUseTemplate = (template: typeof PRESET_TEMPLATES[0]) => {
    setFormData({
      ...template,
      description: template.description,
    });
    setIsCreating(true);
  };

  const handleDelete = (id: string) => {
    onDelete(id);
    MessagePlugin.success('Agent 已删除');
  };

  const getIconComponent = (iconName: string) => {
    const preset = PRESET_ICONS.find(p => p.name === iconName);
    return preset ? preset.icon : Bot;
  };

  const customAgents = agents.filter(a => a.id !== 'default');

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* 页面标题 */}
        <div>
          <h1 
            className="text-2xl font-semibold mb-2"
            style={{ color: 'var(--td-text-color-primary)' }}
          >
            设置
          </h1>
          <p style={{ color: 'var(--td-text-color-secondary)' }}>
            管理 API Key 和自定义 Agent
          </p>
        </div>

        {/* API Key 配置（用户自管） */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2
                className="text-lg font-medium"
                style={{ color: 'var(--td-text-color-primary)' }}
              >
                API Key 配置
              </h2>
              <p
                className="text-sm mt-1"
                style={{ color: 'var(--td-text-color-secondary)' }}
              >
                你自己的 Key，消耗你自己的积分，与他人互不影响
              </p>
            </div>
          </div>

          {/* 当前状态 */}
          <div className="flex items-center gap-3 mb-6">
            {currentKey ? (
              <>
                <CheckCircleFilledIcon
                  size="20px"
                  style={{ color: 'var(--td-success-color)' }}
                />
                <span style={{ color: 'var(--td-text-color-primary)' }}>
                  已配置
                </span>
                <span
                  className="text-sm font-mono"
                  style={{ color: 'var(--td-text-color-secondary)' }}
                >
                  {maskApiKey(currentKey)}
                </span>
              </>
            ) : (
              <>
                <CloseCircleFilledIcon
                  size="20px"
                  style={{ color: 'var(--td-text-color-placeholder)' }}
                />
                <span style={{ color: 'var(--td-text-color-secondary)' }}>
                  未配置
                </span>
              </>
            )}
          </div>

          {/* 修改 / 新增 API Key */}
          {showKeyInput ? (
            <div className="space-y-3">
              <Input
                type="password"
                value={newKey}
                onChange={(v) => setNewKey(v as string)}
                placeholder="粘贴你的千问 / DashScope API Key"
              />
              <div className="flex items-center gap-2">
                <Button
                  theme="primary"
                  size="small"
                  loading={validating}
                  onClick={async () => {
                    const trimmed = newKey.trim();
                    if (!trimmed) {
                      MessagePlugin.warning('请输入 API Key');
                      return;
                    }
                    setValidating(true);
                    try {
                      const res = await fetch('/api/validate-key', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ apiKey: trimmed }),
                      });
                      const data = await res.json();
                      if (data.valid) {
                        setApiKey(trimmed);
                        setCurrentKey(trimmed);
                        setShowKeyInput(false);
                        setNewKey('');
                        MessagePlugin.success('API Key 验证成功并已保存');
                      } else {
                        MessagePlugin.error(data.error || 'API Key 无效');
                      }
                    } catch (e: any) {
                      MessagePlugin.error('验证失败：' + (e?.message || '网络错误'));
                    } finally {
                      setValidating(false);
                    }
                  }}
                >
                  验证并保存
                </Button>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => {
                    setShowKeyInput(false);
                    setNewKey('');
                  }}
                >
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {currentKey ? (
                <>
                  <Button
                    variant="outline"
                    size="small"
                    onClick={() => {
                      setNewKey('');
                      setShowKeyInput(true);
                    }}
                  >
                    更换 API Key
                  </Button>
                  <Popconfirm
                    content="确定清除已保存的 API Key 吗？清除后需重新配置才能使用。"
                    onConfirm={() => {
                      clearApiKey();
                      setCurrentKey('');
                      MessagePlugin.success('API Key 已清除');
                      onApiKeyCleared?.();
                    }}
                  >
                    <Button variant="text" size="small" theme="danger">
                      清除
                    </Button>
                  </Popconfirm>
                </>
              ) : (
                <Button
                  theme="primary"
                  size="small"
                  onClick={() => {
                    setNewKey('');
                    setShowKeyInput(true);
                  }}
                >
                  配置 API Key
                </Button>
              )}
              <Link
                href="https://dashscope.console.aliyun.com"
                target="_blank"
                theme="primary"
                size="small"
              >
                去 dashscope.aliyun.com 获取 Key
                <ExternalLink size={14} style={{ verticalAlign: 'middle', marginLeft: '2px' }} />
              </Link>
            </div>
          )}

          <div
            className="p-4 rounded-lg mt-4 text-xs"
            style={{ backgroundColor: 'var(--td-bg-color-component)' }}
          >
            <p style={{ color: 'var(--td-text-color-secondary)' }}>
              <strong>说明：</strong>每个使用者配置自己的 API Key，AI 回答消耗各自的千问额度。Key 保存在你的浏览器中，不会上传服务器。
            </p>
          </div>
        </div>

        <div 
          style={{ 
            height: '1px', 
            backgroundColor: 'var(--td-component-border)' 
          }} 
        />

        {/* Agent 配置 */}
        <div>
          <div className="mb-4">
            <h2 
              className="text-lg font-medium"
              style={{ color: 'var(--td-text-color-primary)' }}
            >
              Agent 配置
            </h2>
            <p 
              className="text-sm mt-1"
              style={{ color: 'var(--td-text-color-secondary)' }}
            >
              创建和管理自定义 Agent
            </p>
          </div>

          <div className="space-y-6">
              {/* 创建/编辑表单 */}
              {isCreating ? (
                <div 
                  className="p-5 rounded-xl border"
                  style={{ 
                    backgroundColor: 'var(--td-bg-color-container)',
                    borderColor: 'var(--td-component-border)'
                  }}
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-base font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                        {editingAgent ? '编辑 Agent' : '创建新 Agent'}
                      </h4>
                      <Button variant="text" onClick={resetForm}>取消</Button>
                    </div>
                    
                    <Form labelAlign="top">
                      <Form.FormItem label="名称" requiredMark>
                        <Input 
                          value={formData.name}
                          onChange={(v) => setFormData(prev => ({ ...prev, name: v as string }))}
                          placeholder="例如：代码助手"
                        />
                      </Form.FormItem>
                      
                      <Form.FormItem label="描述">
                        <Input 
                          value={formData.description}
                          onChange={(v) => setFormData(prev => ({ ...prev, description: v as string }))}
                          placeholder="简短描述这个 Agent 的用途"
                        />
                      </Form.FormItem>
                      
                      <Form.FormItem label="图标和颜色">
                        <div className="flex gap-4">
                          <div className="flex gap-2">
                            {PRESET_ICONS.map(({ name, icon: Icon }) => (
                              <button
                                key={name}
                                type="button"
                                className="w-9 h-9 rounded-lg flex items-center justify-center transition-all border-2"
                                style={{
                                  backgroundColor: formData.icon === name ? formData.color : 'transparent',
                                  color: formData.icon === name ? 'white' : 'var(--td-text-color-secondary)',
                                  borderColor: formData.icon === name ? formData.color : 'var(--td-component-border)',
                                }}
                                onClick={() => setFormData(prev => ({ ...prev, icon: name }))}
                              >
                                <Icon size={18} />
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-1.5 items-center">
                            {PRESET_COLORS.map(color => (
                              <button
                                key={color}
                                type="button"
                                className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                                style={{ backgroundColor: color }}
                                onClick={() => setFormData(prev => ({ ...prev, color }))}
                              >
                                {formData.color === color && <CheckIcon style={{ color: 'white' }} size="14px" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      </Form.FormItem>
                      
                      <Form.FormItem label="权限模式">
                        <Select
                          value={formData.permissionMode}
                          onChange={(v) => setFormData(prev => ({ ...prev, permissionMode: v as PermissionMode }))}
                          style={{ width: '100%' }}
                        >
                          {PERMISSION_MODES.map(mode => (
                            <Select.Option key={mode.value} value={mode.value} label={mode.label}>
                              <div className="flex flex-col py-1">
                                <span className="font-mono text-sm" style={{ color: 'var(--td-success-color)' }}>
                                  {mode.label}
                                </span>
                                <span className="text-xs" style={{ color: 'var(--td-text-color-placeholder)' }}>
                                  {mode.description}
                                </span>
                              </div>
                            </Select.Option>
                          ))}
                        </Select>
                      </Form.FormItem>
                      
                      <Form.FormItem label="系统提示词" requiredMark>
                        <Textarea 
                          value={formData.systemPrompt}
                          onChange={(v) => setFormData(prev => ({ ...prev, systemPrompt: v as string }))}
                          placeholder="定义 Agent 的行为和能力..."
                          autosize={{ minRows: 4, maxRows: 8 }}
                        />
                      </Form.FormItem>
                    </Form>
                    
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={resetForm}>取消</Button>
                      <Button theme="primary" onClick={handleSave}>
                        {editingAgent ? '保存修改' : '创建 Agent'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* 快速模板 */}
                  <div>
                    <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--td-text-color-secondary)' }}>
                      快速创建
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {PRESET_TEMPLATES.map(template => {
                        const Icon = getIconComponent(template.icon);
                        return (
                          <div 
                            key={template.name} 
                            className="p-3 rounded-lg cursor-pointer transition-all hover:shadow-md"
                            style={{ backgroundColor: 'var(--td-bg-color-component)' }}
                            onClick={() => handleUseTemplate(template)}
                          >
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: template.color }}
                              >
                                <Icon size={20} color="white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate" style={{ color: 'var(--td-text-color-primary)' }}>
                                  {template.name}
                                </div>
                                <div className="text-xs truncate" style={{ color: 'var(--td-text-color-placeholder)' }}>
                                  {template.description}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 自定义创建按钮 */}
                  <Button 
                    icon={<AddIcon />} 
                    variant="dashed" 
                    block 
                    onClick={() => setIsCreating(true)}
                  >
                    从头创建 Agent
                  </Button>

                  {/* 已有的自定义 Agent */}
                  {customAgents.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3" style={{ color: 'var(--td-text-color-secondary)' }}>
                        我的 Agent ({customAgents.length})
                      </h4>
                      <div className="space-y-2">
                        {customAgents.map(agent => {
                          const Icon = getIconComponent(agent.icon || 'Bot');
                          return (
                            <div 
                              key={agent.id} 
                              className="p-3 rounded-lg"
                              style={{ backgroundColor: 'var(--td-bg-color-component)' }}
                            >
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ backgroundColor: agent.color || '#0052d9' }}
                                >
                                  <Icon size={20} color="white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium" style={{ color: 'var(--td-text-color-primary)' }}>
                                    {agent.name}
                                  </div>
                                  <div className="text-xs truncate" style={{ color: 'var(--td-text-color-placeholder)' }}>
                                    {agent.description || agent.systemPrompt.slice(0, 50) + '...'}
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Tooltip content="编辑">
                                    <Button 
                                      variant="text" 
                                      shape="circle" 
                                      size="small"
                                      icon={<EditIcon />}
                                      onClick={() => handleEdit(agent)}
                                    />
                                  </Tooltip>
                                  <Popconfirm
                                    content="确定删除这个 Agent 吗？"
                                    onConfirm={() => handleDelete(agent.id)}
                                  >
                                    <Tooltip content="删除">
                                      <Button 
                                        variant="text" 
                                        shape="circle" 
                                        size="small"
                                        icon={<DeleteIcon />}
                                      />
                                    </Tooltip>
                                  </Popconfirm>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}
