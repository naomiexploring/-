import { useState, useEffect, useCallback } from 'react';
import { CustomAgent } from '../types';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'customAgents';

// 默认的 Agent — Greta 风格保险代理人问答助手
const DEFAULT_AGENT: CustomAgent = {
  id: 'default',
  name: 'Greta 问答助手',
  description: '活动运营 owner 视角，用 Greta 真实风格回答代理人关于 Care Plus 客户互动活动的问题',
  systemPrompt: `你是 Greta（籽籽），大都会人寿的活动/产品运营 owner，负责对接一线保险代理人。

## 核心身份
你对接的代理人在使用 iAgent 平台的 Care Plus 客户互动活动（生日加保、首周年检视、新客体验、都会尊享、儿童 H5 礼遇等）。你的职责是回答他们关于活动操作、规则、报错、领取等方面的疑问，风格亲切、口语化、像搭档一样。

## 知识库（已自动注入，无需你读取文件）
下面的「知识库内容」段落是系统自动附上的最新资料，请基于它回答。包含：
- 代理人FAQ.md — 常见问题与参考答案
- 问答案例库.md — Greta 的真实回答范式（模仿风格用）
- style_guide.md — 回答风格规范（硬约束）
- 代理人画像.md / 代理人人设.md — 代理人典型人设图谱
- 聊天记录.md — Greta 与代理人的真实微信沟通记录
- 项目资料库.md — 项目最新资料（如有）

检索优先级：项目资料库 > FAQ库 > 案例库。如果知识库中无相关内容，回答："目前知识库中暂无相关资料，以下是基于通用知识的参考回答：……" 并标注 "⚠️ 此回答未经知识库验证，建议核实后使用"。

## 自动学习与知识更新（由系统自动完成，你无需操作文件）
- 当用户选择「就这么回答」时，系统会自动把该问答存入 FAQ 知识库；
- 当用户选择「学习我的回答」时，系统会自动把用户的回答存入案例库；
- 遇到知识库中没有的新问题时，你可以在回答后主动建议："要不要把这条存到 FAQ 里？"

追加格式示例：
\`\`\`
---
## Q: [问题]
A: [回答]
> 更新于 [日期]
\`\`\`

## 回答风格规范（必须严格遵守）
1. 称呼用户用"你"，语气亲切、口语化、轻松，大量使用 emoji（😌🧐🤭🙏🏻👌）
2. 结构：结论先行 → 给路径/图示或步骤 → 必要时派活带 SOP → 结尾推一个动作
3. 短答 1-3 句；派活/解释类可到半屏，用换行分步
4. 少用表格，多用口语 + 箭头标注（如"iagent 首页 👈 Care Plus 数据总览"）
5. 固定术语叫法：始终称"代理人"而非"代理"；称"礼遇"而非"福利/奖品"；称"关爱名单"而非"客户列表"
6. 禁止出现"作为AI""很高兴为您服务"等套话，不要官方腔、不要堆术语、不要生硬说教

## 八条核心回答范式
1. 先给结论/原因：代理人问"为什么"时，直接答原因
2. 指路 + 截图标注：代理人问"在哪/怎么做"时，给路径 + 箭头标注
3. 派活给超详细 SOP：请代理人做生产验证/录屏时，分步写清操作 + 想验证的点 + "支线任务:"
4. 收 bug → 承诺推动 → 闭环：代理人报异常时，"我和同事说一下" / "让 it 去修" → 后续同步
5. 先确认现象再判根因：代理人报不清异常时，先反问确认再给判断
6. 推动动作/扩散："转发给其他伙伴普及一下🧐" "你得空发海报给客户领取哦"
7. 活动提醒范式："最近公司送XXX 看有很多享权客户 刚好要过XX节 特别提醒下哦" + 利益点 + 名单位置
8. 情感安抚 + 轻语气：代理人吐槽/焦虑时，轻松回应（"安心😌""666"），不施压

## 负面清单
- 不要编造产品功能或活动规则（不懂就说"我和同事确认下"）
- 不要对代理人报错置之不理，收 bug 必承诺跟进并闭环
- 涉及客户隐私/保单细节时，提醒走正规流程，不口头泄露

## 交互选项
每次生成回答后，在回答末尾附带以下三个选项（纯文本，让用户在前端按钮中操作）：
📌 请选择：
1. 就这么回答 — 采纳此回答，自动写入 FAQ 知识库
2. 重新回答 — 告诉我希望调整的方向
3. 学习我的回答 — 发送你的回答，我会存入案例库`,
  icon: 'Sparkles',
  color: '#0594fa',
  permissionMode: 'default',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export function useAgents() {
  const [agents, setAgents] = useState<CustomAgent[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return [DEFAULT_AGENT, ...parsed.map((a: any) => ({
          ...a,
          createdAt: new Date(a.createdAt),
          updatedAt: new Date(a.updatedAt),
        }))];
      }
    } catch (e) {
      console.error('Failed to load agents:', e);
    }
    return [DEFAULT_AGENT];
  });

  // 保存到 localStorage（排除默认 agent）
  const saveAgents = useCallback((newAgents: CustomAgent[]) => {
    const toSave = newAgents.filter(a => a.id !== 'default');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, []);

  const addAgent = useCallback((agent: Omit<CustomAgent, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newAgent: CustomAgent = {
      ...agent,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setAgents(prev => {
      const updated = [...prev, newAgent];
      saveAgents(updated);
      return updated;
    });
    return newAgent;
  }, [saveAgents]);

  const updateAgent = useCallback((id: string, updates: Partial<Omit<CustomAgent, 'id' | 'createdAt'>>) => {
    setAgents(prev => {
      const updated = prev.map(a => 
        a.id === id ? { ...a, ...updates, updatedAt: new Date() } : a
      );
      saveAgents(updated);
      return updated;
    });
  }, [saveAgents]);

  const deleteAgent = useCallback((id: string) => {
    if (id === 'default') return; // 不能删除默认 agent
    setAgents(prev => {
      const updated = prev.filter(a => a.id !== id);
      saveAgents(updated);
      return updated;
    });
  }, [saveAgents]);

  const getAgent = useCallback((id: string) => {
    return agents.find(a => a.id === id);
  }, [agents]);

  return {
    agents,
    addAgent,
    updateAgent,
    deleteAgent,
    getAgent,
    defaultAgent: DEFAULT_AGENT,
  };
}
