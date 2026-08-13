import express from "express";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import { fileURLToPath } from "url";
import * as db from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware（提高 JSON 体积上限以允许前端以 base64 直接传图片/文档）
app.use(express.json({ limit: "50mb" }));

// ============= 千问 / DashScope 配置 =============
// 通义千问 OpenAI 兼容接口（无需任何 SDK，Node 自带 fetch 即可调用）
const DASHSCOPE_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

// 默认模型：用户指定 Qwen3.7，裸名不存在，使用旗舰文本模型 qwen3.7-max
const defaultModel = "qwen3.7-max";

// 可选模型列表（前端可切换）
// vision=true 表示该模型支持图片/多模态输入（截图问答需路由到这类模型）
const QWEN_MODELS = [
  { modelId: "qwen3.7-max", name: "通义千问 Qwen3.7-Max（旗舰·纯文本）" },
  { modelId: "qwen3.7-plus", name: "通义千问 Qwen3.7-Plus（视觉+文本）", vision: true },
  { modelId: "qwen3.7-flash", name: "通义千问 Qwen3.7-Flash（最便宜·纯文本）" },
  { modelId: "qwen3.6-plus", name: "通义千问 Qwen3.6-Plus（视觉+文本·备选）", vision: true },
];

// 第一个支持视觉的模型（图片自动路由到此）
const DEFAULT_VISION_MODEL = QWEN_MODELS.find((m) => m.vision)?.modelId || "qwen3.7-plus";

// 健康检查
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 验证用户的千问 / DashScope API Key 是否有效
app.post("/api/validate-key", async (req, res) => {
  const { apiKey } = req.body;

  if (!apiKey || typeof apiKey !== "string") {
    return res.status(400).json({ valid: false, error: "请提供 API Key" });
  }

  try {
    // 用该 Key 发一个极小请求来验证是否有效（max_tokens=1，几乎不消耗额度）
    const testRes = await fetch(DASHSCOPE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: defaultModel,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false,
      }),
    });

    if (!testRes.ok) {
      const errText = await testRes.text();
      let msg = "API Key 无效";
      try {
        const e = JSON.parse(errText);
        if (e?.message) msg = e.message;
      } catch {
        msg = errText.slice(0, 200);
      }
      return res.json({ valid: false, error: `千问 API Key 无效或额度不足：${msg}` });
    }

    res.json({ valid: true, message: "千问 API Key 验证成功" });
  } catch (error: any) {
    console.error("[Validate Key] Error:", error);
    res.json({
      valid: false,
      error: error?.message || "API Key 无效或网络错误，请检查后重试",
    });
  }
});

// ============= 知识库管理 API =============

const KNOWLEDGE_BASE_DIR = path.join(__dirname, "..", "knowledge-base");

// 确保知识库目录存在
if (!fs.existsSync(KNOWLEDGE_BASE_DIR)) {
  fs.mkdirSync(KNOWLEDGE_BASE_DIR, { recursive: true });
}

// 读取全部知识库内容，拼接成一段上下文字符串（注入到 system prompt）
function loadKnowledgeContext(): string {
  try {
    const files = fs
      .readdirSync(KNOWLEDGE_BASE_DIR)
      .filter((f) => f.endsWith(".md"))
      .sort();
    const parts: string[] = [];
    for (const f of files) {
      const content = fs.readFileSync(path.join(KNOWLEDGE_BASE_DIR, f), "utf-8");
      parts.push(`### 文件：${f}\n\n${content}`);
    }
    return parts.join("\n\n");
  } catch (e) {
    console.error("[Knowledge] load error:", e);
    return "";
  }
}

// ============= FAQ 整理：去重 / 就地优化 / 精简 / 清理话术 =============

// 命中即视为 UI 交互话术的关键词（整段删掉）
const CTA_KEYWORDS = [
  "就这么回答",
  "重新回答",
  "学习我的回答",
  "采纳此回答",
  "自动写入 FAQ 知识库",
  "告诉我要调整的方向",
  "发送你的回答",
  "我会存入案例库",
  "请选择",
];

// 清理 UI 交互话术（CTA）：删除整段已知话术，并逐行删除含关键词的行
function stripCtaPhrases(text: string): string {
  if (!text) return text;
  let out = text;
  // 1) 整段柔性匹配：📌 请选择：... 直到 存入案例库/我会存入案例库 之后
  out = out.replace(
    /📌?\s*请选择[：:][\s\S]*?(?:存入案例库|我会存入案例库)[\s\S]{0,30}/gu,
    ""
  );
  // 2) 逐行删除含 CTA 关键词的行
  out = out
    .split("\n")
    .filter((line) => {
      const l = line.trim();
      if (!l) return true;
      return !CTA_KEYWORDS.some((k) => l.includes(k));
    })
    .join("\n");
  // 3) 清理被删空后的孤立行号（如 "1." "2. "）
  out = out.replace(/^\s*\d+\.\s*$/gm, "");
  // 4) 折叠多余空行
  out = out.replace(/\n{3,}/g, "\n\n").trim();
  return out;
}

// 去除 emoji / 表情符号（保留中文、标点与换行结构）
function stripEmoji(text: string): string {
  if (!text) return text;
  return text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u200D\uFE00-\uFE0F]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// 非流式调用千问，返回纯文本
async function callQwenText(
  apiKey: string,
  messages: { role: string; content: string }[],
  model = defaultModel
): Promise<string> {
  const res = await fetch(DASHSCOPE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 4096,
      temperature: 0.2,
      stream: false,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DashScope ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

// 用千问整理 FAQ：语义去重 + 就地优化 + 精简 + 去 CTA/emoji + 格式归一，返回完整文件
async function mergeFaqWithModel(
  apiKey: string,
  existing: string,
  question: string,
  draftAnswer: string
): Promise<string> {
  const sysPrompt = `你负责维护一个 Markdown 格式的 FAQ 知识库文件。该文件当前使用的格式是：
- 顶部一行标题（以 # 开头）
- 章节用 "## N. 章节名" 分隔
- 每个问题写成 "**Q：问题文字**"，紧跟其后是 "A：回答文字"；一个章节内可有多个问答连续排列
请严格遵守：
1. 若文件中已存在相同或语义等价的问题（无论它在哪一行），请在原位置就地优化/更新其对应的 A：回答，不要新增重复问答。
2. 若是全新问题，请把新问答追加到最相关的已有章节末尾；若都不相关，则在文件末尾新建一个 "## N. 新章节" 再放进去。新问答格式必须为 "**Q：问题**" 换行 "A：回答"。
3. 所有回答必须简明、专业、口语化适度；去除 emoji/表情符号，以及任何 UI 交互话术（如"就这么回答""重新回答""学习我的回答""采纳此回答""自动写入FAQ""告诉我希望调整的方向""发送你的回答"等）。
4. 绝对不要把任何 UI 交互话术写进知识库。
5. 保留与本次问题无关的其他已有问答；对它们仅做必要的格式清理：去掉 emoji、去掉 "更新于 ..." 这类时间戳行、把旧写法 "**回答：**" 统一改为 "A："。
6. 只输出更新后的【完整文件内容】，不要用代码块围栏包裹，不要任何额外说明。`;

  const userPrompt = `【当前 FAQ 文件内容】\n${existing || "（空文件）"}\n\n【待整理的新问答】\n问题：${question}\n草稿回答（可能含口语/emoji/UI话术，请整理为简明版本）：${draftAnswer}\n\n请返回整理后的完整 FAQ 文件内容。`;

  const text = await callQwenText(apiKey, [
    { role: "system", content: sysPrompt },
    { role: "user", content: userPrompt },
  ]);

  let cleaned = text
    .trim()
    .replace(/^```(?:markdown)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  if (!cleaned) throw new Error("模型返回为空");
  // 二次保险：再清一遍 CTA 与 emoji（注意：只清字符，不压缩换行）
  cleaned = stripEmoji(stripCtaPhrases(cleaned));
  return cleaned;
}

// 规则兜底去重：精确匹配 **Q：问题**，命中则就地替换该条目，否则追加到末尾
function mergeFaqRuleBased(
  existing: string,
  question: string,
  cleanAnswer: string
): string {
  const qNorm = question.trim();
  // 与现有 FAQ 保持一致：**Q：问题** 换行 A：回答
  const newEntry = `**Q：${qNorm}**\n\nA：${cleanAnswer}\n`;
  const lines = existing.split("\n");

  let foundIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*\*\*Q[:：]\s*(.*?)\s*\*\*/u);
    if (m && m[1].trim() === qNorm) {
      foundIdx = i;
      break;
    }
  }

  if (foundIdx >= 0) {
    // 找到该问答的结束位置：下一个 **Q： 或 ## 章节 或 --- 分隔线
    let endIdx = lines.length;
    for (let j = foundIdx + 1; j < lines.length; j++) {
      if (
        /^\s*\*\*Q[:：]/.test(lines[j]) ||
        /^\s*##\s/.test(lines[j]) ||
        /^\s*---\s*$/.test(lines[j])
      ) {
        endIdx = j;
        break;
      }
    }
    lines.splice(foundIdx, endIdx - foundIdx, newEntry.trimEnd());
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
  }

  // 不存在则追加到末尾
  const sep = /---\s*$/.test(existing.trim()) ? "\n\n" : (existing.trim() ? "\n\n---\n\n" : "");
  return (existing.trim() + sep + newEntry).replace(/\n{3,}/g, "\n\n").trim() + "\n";
}


// ============= 多模态 / 文档解析辅助函数 =============

// 把 "data:image/png;base64,xxxx" 解码为 { mime, buffer }
function decodeDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx === -1) {
    return { mime: "application/octet-stream", buffer: Buffer.from(dataUrl, "base64") };
  }
  const meta = dataUrl.slice(0, commaIdx); // data:image/png;base64
  const mimeMatch = meta.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const base64 = dataUrl.slice(commaIdx + 1);
  return { mime, buffer: Buffer.from(base64, "base64") };
}

// 仅支持 .md 项目资料文件：直接解码为 UTF-8 文本后写入知识库（见 /api/chat 预处理段）
// 不再解析 PDF / Word / PPT 等二进制格式

// 列出所有知识库文件
app.get("/api/knowledge", async (req, res) => {
  try {
    const files = await fsp.readdir(KNOWLEDGE_BASE_DIR);
    const fileDetails = await Promise.all(
      files
        .filter((f) => f.endsWith(".md"))
        .map(async (f) => {
          const filePath = path.join(KNOWLEDGE_BASE_DIR, f);
          const stat = await fsp.stat(filePath);
          const content = await fsp.readFile(filePath, "utf-8");
          const lines = content.split("\n");
          return {
            filename: f,
            size: stat.size,
            lineCount: lines.length,
            wordCount: content.length,
            preview: content.slice(0, 200) + (content.length > 200 ? "..." : ""),
            updatedAt: stat.mtime.toISOString(),
          };
        })
    );
    res.json({ files: fileDetails.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
  } catch (error: any) {
    console.error("[Knowledge] List error:", error);
    res.status(500).json({ error: error?.message || "获取知识库列表失败" });
  }
});

// 知识库统计（必须在 :filename 路由之前定义）
app.get("/api/knowledge/stats", async (req, res) => {
  try {
    const files = await fsp.readdir(KNOWLEDGE_BASE_DIR);
    const mdFiles = files.filter((f) => f.endsWith(".md"));

    let totalSize = 0;
    let totalLines = 0;
    let totalWords = 0;
    const fileStats = [];

    for (const f of mdFiles) {
      const filePath = path.join(KNOWLEDGE_BASE_DIR, f);
      const stat = await fsp.stat(filePath);
      const content = await fsp.readFile(filePath, "utf-8");
      totalSize += stat.size;
      totalLines += content.split("\n").length;
      totalWords += content.length;
      fileStats.push({
        filename: f,
        size: stat.size,
        lines: content.split("\n").length,
        words: content.length,
        updatedAt: stat.mtime.toISOString(),
      });
    }

    res.json({
      totalFiles: mdFiles.length,
      totalSize,
      totalLines,
      totalWords,
      files: fileStats.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    });
  } catch (error: any) {
    console.error("[Knowledge] Stats error:", error);
    res.status(500).json({ error: error?.message || "获取统计失败" });
  }
});

// 获取单个知识库文件内容
app.get("/api/knowledge/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(KNOWLEDGE_BASE_DIR, path.basename(filename));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "文件不存在" });
    }

    const content = await fsp.readFile(filePath, "utf-8");
    const stat = await fsp.stat(filePath);
    res.json({
      filename,
      content,
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  } catch (error: any) {
    console.error("[Knowledge] Read error:", error);
    res.status(500).json({ error: error?.message || "读取知识库文件失败" });
  }
});

// 新增/追加知识库内容
app.post("/api/knowledge", async (req, res) => {
  try {
    const { filename, content, mode } = req.body;

    if (!filename || !content) {
      return res.status(400).json({ error: "文件名和内容不能为空" });
    }

    // 安全检查：只允许 .md 文件，防止路径遍历
    const safeName = path.basename(filename).replace(/[^a-zA-Z0-9一-龥._-]/g, "");
    if (!safeName.endsWith(".md")) {
      return res.status(400).json({ error: "只支持 .md 文件" });
    }

    const filePath = path.join(KNOWLEDGE_BASE_DIR, safeName);
    const timestamp = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

    if (mode === "overwrite") {
      await fsp.writeFile(filePath, content, "utf-8");
    } else {
      // 默认追加模式
      const header = `\n\n---\n\n> 📥 新增于 ${timestamp}\n\n`;
      await fsp.appendFile(filePath, header + content + "\n", "utf-8");
    }

    const stat = await fsp.stat(filePath);
    res.json({
      success: true,
      filename: safeName,
      message: mode === "overwrite" ? "文件已更新" : "内容已追加",
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  } catch (error: any) {
    console.error("[Knowledge] Add error:", error);
    res.status(500).json({ error: error?.message || "添加知识库内容失败" });
  }
});

// 创建新知识库文件
app.post("/api/knowledge/create", async (req, res) => {
  try {
    const { filename, content, description } = req.body;

    if (!filename) {
      return res.status(400).json({ error: "文件名不能为空" });
    }

    const safeName = path.basename(filename).replace(/[^a-zA-Z0-9一-龥._-]/g, "");
    if (!safeName.endsWith(".md")) {
      safeName + ".md";
    }
    const finalName = safeName.endsWith(".md") ? safeName : safeName + ".md";

    const filePath = path.join(KNOWLEDGE_BASE_DIR, finalName);

    if (fs.existsSync(filePath)) {
      return res.status(409).json({ error: "文件已存在" });
    }

    const timestamp = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    const header = `# ${description || finalName.replace(".md", "")}\n\n> 创建于 ${timestamp}\n\n`;
    await fsp.writeFile(filePath, header + (content || ""), "utf-8");

    res.json({ success: true, filename: finalName, message: "文件创建成功" });
  } catch (error: any) {
    console.error("[Knowledge] Create error:", error);
    res.status(500).json({ error: error?.message || "创建知识库文件失败" });
  }
});

// 删除知识库文件
app.delete("/api/knowledge/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const safeName = path.basename(filename);
    const filePath = path.join(KNOWLEDGE_BASE_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "文件不存在" });
    }

    await fsp.unlink(filePath);
    res.json({ success: true, message: `已删除 ${safeName}` });
  } catch (error: any) {
    console.error("[Knowledge] Delete error:", error);
    res.status(500).json({ error: error?.message || "删除知识库文件失败" });
  }
});

// 学习问答对（核心：自动更新知识库）
app.post("/api/learn", async (req, res) => {
  try {
    const { type, question, answer, userAnswer, category } = req.body;

    if (!question) {
      return res.status(400).json({ error: "问题不能为空" });
    }

    const timestamp = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
    const entry = `\n\n---\n\n## ${question}\n\n> 更新于 ${timestamp}\n\n`;

    if (type === "accept_answer") {
      // 采纳回答 → 整理后写入 FAQ（去重 / 就地优化 / 精简 / 去 CTA+emoji）
      const faqPath = path.join(KNOWLEDGE_BASE_DIR, "代理人FAQ.md");
      let existing = "";
      if (fs.existsSync(faqPath)) {
        existing = await fsp.readFile(faqPath, "utf-8");
      }

      const apiKey = req.body.apiKey;
      if (apiKey) {
        try {
          const updated = await mergeFaqWithModel(apiKey, existing, question, answer || "");
          // 整文件再清一遍（连历史脏数据里的 CTA/emoji 也一并去除）
          await fsp.writeFile(faqPath, stripEmoji(stripCtaPhrases(updated)), "utf-8");
          return res.json({
            success: true,
            message: "已整理并更新 FAQ 知识库（去重/精简）",
            savedTo: "代理人FAQ.md",
          });
        } catch (e) {
          console.error("[Learn] 模型整理失败，改用规则兜底：", e);
        }
      }
      // 兜底：规则去重 + 就地替换（先做基础清理）
      const cleanDraft = stripEmoji(stripCtaPhrases(answer || ""));
      const merged = mergeFaqRuleBased(existing, question, cleanDraft);
      // 整文件再清一遍（连历史脏数据里的 CTA/emoji 也一并去除）
      await fsp.writeFile(faqPath, stripEmoji(stripCtaPhrases(merged)), "utf-8");
      res.json({
        success: true,
        message: "已保存到 FAQ 知识库",
        savedTo: "代理人FAQ.md",
      });
    } else if (type === "learn_answer") {
      // 学习用户回答 → 写入案例库（清理 CTA 话术与 emoji，并对整文件去历史脏数据）
      const casePath = path.join(KNOWLEDGE_BASE_DIR, "问答案例库.md");
      const raw = userAnswer || answer || "";
      const clean = stripEmoji(stripCtaPhrases(raw));
      let caseContent = "";
      if (fs.existsSync(casePath)) {
        caseContent = await fsp.readFile(casePath, "utf-8");
      }
      caseContent = caseContent + entry + `**Greta 风格回答：**\n\n${clean}\n`;
      await fsp.writeFile(casePath, stripEmoji(stripCtaPhrases(caseContent)), "utf-8");
      res.json({
        success: true,
        message: "已将你的回答保存到案例库",
        savedTo: "问答案例库.md",
      });
    } else if (type === "add_material") {
      // 新增项目资料 → 创建新文件或追加
      const targetFile = category || "项目资料库.md";
      const safeName = path.basename(targetFile).replace(/[^a-zA-Z0-9一-龥._-]/g, "");
      const finalName = safeName.endsWith(".md") ? safeName : safeName + ".md";
      const filePath = path.join(KNOWLEDGE_BASE_DIR, finalName);

      if (fs.existsSync(filePath)) {
        await fsp.appendFile(filePath, entry + answer + "\n", "utf-8");
        res.json({ success: true, message: `已追加到 ${finalName}`, savedTo: finalName });
      } else {
        const header = `# ${finalName.replace(".md", "")}\n\n> 创建于 ${timestamp}\n\n`;
        await fsp.writeFile(filePath, header + answer + "\n", "utf-8");
        res.json({ success: true, message: `已创建新文件 ${finalName}`, savedTo: finalName });
      }
    } else {
      res.status(400).json({ error: "未知的学习类型" });
    }
  } catch (error: any) {
    console.error("[Learn] Error:", error);
    res.status(500).json({ error: error?.message || "学习失败" });
  }
});

// 获取可用模型列表（千问模型，静态返回，无需调用 API）
app.get("/api/models", async (req, res) => {
  try {
    res.json({
      models: QWEN_MODELS,
      defaultModel,
    });
  } catch (error: any) {
    console.error("[Models] Error:", error);
    res.json({ models: QWEN_MODELS, defaultModel });
  }
});

// ============= 会话 API =============

// 获取所有会话（包含消息数量）
app.get("/api/sessions", (req, res) => {
  try {
    const sessions = db.getAllSessions();
    const sessionsWithMessages = sessions.map((session) => {
      const messages = db.getMessagesBySession(session.id);
      return {
        ...session,
        messageCount: messages.length,
      };
    });
    res.json({ sessions: sessionsWithMessages });
  } catch (error: any) {
    console.error("[Sessions] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 获取单个会话及其消息
app.get("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = db.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: "会话不存在" });
    }

    const messages = db.getMessagesBySession(sessionId);

    // 解析 tool_calls JSON
    const parsedMessages = messages.map((msg) => ({
      ...msg,
      tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null,
    }));

    res.json({ session, messages: parsedMessages });
  } catch (error: any) {
    console.error("[Session] Error:", error);
    res.status(500).json({ error: error?.message || "获取会话失败" });
  }
});

// 创建新会话
app.post("/api/sessions", (req, res) => {
  try {
    const { model = defaultModel, title = "新对话" } = req.body;
    const now = new Date().toISOString();

    const session = db.createSession({
      id: uuidv4(),
      title,
      model,
      created_at: now,
      updated_at: now,
    });

    res.json({ session });
  } catch (error: any) {
    console.error("[Create Session] Error:", error);
    res.status(500).json({ error: error?.message || "创建会话失败" });
  }
});

// 更新会话
app.patch("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title, model } = req.body;

    const success = db.updateSession(sessionId, { title, model });

    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Update Session] Error:", error);
    res.status(500).json({ error: error?.message || "更新会话失败" });
  }
});

// 删除会话
app.delete("/api/sessions/:sessionId", (req, res) => {
  try {
    const { sessionId } = req.params;
    const success = db.deleteSession(sessionId);

    if (!success) {
      return res.status(404).json({ error: "会话不存在" });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("[Delete Session] Error:", error);
    res.status(500).json({ error: error?.message || "删除会话失败" });
  }
});

// ============= 聊天 API（千问 / DashScope） =============

// 默认系统提示词 — Greta 风格保险代理人问答助手
// 注意：知识库由后端注入到下方「知识库内容」段落，模型无需调用任何工具
const defaultSystemPrompt = `你是 Greta（籽籽），大都会人寿的活动/产品运营 owner，负责对接一线保险代理人。

## 核心身份
你对接的代理人在使用 iAgent 平台的 Care Plus 客户互动活动（生日加保、首周年检视、新客体验、都会尊享、儿童 H5 礼遇等）。你的职责是回答他们关于活动操作、规则、报错、领取等方面的疑问，风格亲切、口语化、像搭档一样。

## 知识库（已自动注入，无需你读取文件）
下面「知识库内容」段落是系统自动附上的最新资料，请基于它回答。包含：
- 代理人FAQ.md — 常见问题与参考答案
- 问答案例库.md — Greta 的真实回答范式（模仿风格用）
- style_guide.md — 回答风格规范（硬约束）
- 代理人画像.md / 代理人人设.md — 代理人典型人设图谱
- 聊天记录.md — Greta 与代理人的真实微信沟通记录
- 项目资料库.md — 项目最新资料（如有）

检索优先级：项目资料库 > FAQ库 > 案例库。如果知识库中无相关内容，回答："目前知识库中暂无相关资料，以下是基于通用知识的参考回答：……" 并标注 "⚠️ 此回答未经知识库验证，建议核实后使用"。

## 多模态输入（图片 / 项目资料）
- 用户可能直接发来一张微信截图问问题（如活动报错、页面样式、规则疑问），请结合图片内容直接回答，并在需要时给出路径/入口
- 用户会上传 .md 格式的项目资料文件，对话里会出现「用户上传的项目资料文件」区块；系统已自动把该文件存入项目资料库，请基于其内容回答用户问题，并可在用户无额外问题时简要说明资料要点

## 自动学习与知识更新（由系统自动完成，你无需操作文件）
- 当用户选择「就这么回答」时，系统会自动把该问答存入 FAQ 知识库；
- 当用户选择「学习我的回答」时，系统会自动把用户的回答存入案例库；
- 遇到知识库中没有的新问题时，你可以在回答后主动建议："要不要把这条存到 FAQ 里？"

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

## 交互说明（重要）
- 「就这么回答 / 重新回答 / 学习我的回答」是前端按钮，由系统自动处理，你【不要】在回答文字里输出这些选项或任何"请选择"类话术。
- 「采纳此回答」「自动写入 FAQ 知识库」「告诉我希望调整的方向」「发送你的回答」「我会存入案例库」等 UI 说明也【不要】出现在你的回答中。`;

// 发送消息并获取流式响应（调用千问 / DashScope）
// 支持：纯文本、图片（截图问答，自动路由视觉模型）、.md 项目资料（直接写入知识库）
app.post("/api/chat", async (req, res) => {
  const {
    sessionId,
    message,
    model,
    systemPrompt,
    apiKey,
    images, // string[]，前端以 data URL 传入的截图
    documents, // { name: string; data: string }[]，前端以 data URL 传入的项目资料（仅 .md）
  } = req.body;

  const hasImages = Array.isArray(images) && images.length > 0;
  const hasDocs = Array.isArray(documents) && documents.length > 0;

  console.log(`\n[Chat] ========== 新请求 ==========`);
  console.log(`[Chat] SessionId: ${sessionId}`);
  console.log(`[Chat] Model: ${model}`);
  console.log(`[Chat] 图片: ${hasImages ? images.length : 0} 张, 项目资料(.md): ${hasDocs ? documents.length : 0} 个`);
  console.log(`[Chat] Message: ${message?.slice(0, 100)}${message?.length > 100 ? "..." : ""}`);

  // 纯文本、图片、文档至少要有一种内容
  if (!message && !hasImages && !hasDocs) {
    console.log(`[Chat] 错误: 消息为空`);
    return res.status(400).json({ error: "消息不能为空" });
  }

  // 用户必须提供自己的千问 API Key（按请求切换，各用户消耗各自额度）
  if (!apiKey) {
    console.log(`[Chat] 错误: 未提供 API Key`);
    return res.status(401).json({ error: "请先在设置中配置你的千问 / DashScope API Key" });
  }

  // 预处理项目资料文件：仅接受 .md，解码后直接写入知识库（同名覆盖更新）
  const mdDocs: { name: string; text: string }[] = [];
  const savedFiles: string[] = [];
  if (hasDocs) {
    for (const doc of documents) {
      const name = doc?.name || "未命名文件";
      const ext = path.extname(name).toLowerCase();
      if (ext !== ".md") {
        return res.status(400).json({
          error: `暂仅支持 .md 项目资料文件，不支持「${name}」（${
            ext || "未知格式"
          }）。请上传 .md 文件；图片可直接发送。`,
        });
      }
      try {
        const { buffer } = decodeDataUrl(doc.data || "");
        const text = buffer.toString("utf-8");
        if (!text.trim()) {
          return res.status(400).json({ error: `文件「${name}」内容为空` });
        }
        mdDocs.push({ name, text });
        // 直接写入知识库（同名则覆盖更新）
        const safeBase = path.basename(name).replace(/[^a-zA-Z0-9一-龥._-]/g, "") || "项目资料";
        const finalName = safeBase.endsWith(".md") ? safeBase : safeBase + ".md";
        const filePath = path.join(KNOWLEDGE_BASE_DIR, finalName);
        const timestamp = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
        const header = `# ${finalName.replace(".md", "")}\n\n> 由 ${name} 于 ${timestamp} 上传至项目资料库\n\n`;
        await fsp.writeFile(filePath, header + text + "\n", "utf-8");
        savedFiles.push(finalName);
        console.log(`[Chat] 已写入项目资料库: ${finalName}`);
      } catch (e: any) {
        return res.status(400).json({ error: `处理文件「${name}」失败：${e?.message || "未知错误"}` });
      }
    }
  }

  // 获取或创建会话
  let session = sessionId ? db.getSession(sessionId) : null;
  const now = new Date().toISOString();
  const sessionTitle =
    message?.slice(0, 30) || (hasImages ? "[图片提问]" : "") || (mdDocs[0]?.name || "新对话");

  if (!session) {
    console.log(`[Chat] 创建新会话`);
    session = db.createSession({
      id: sessionId || uuidv4(),
      title: sessionTitle + (sessionTitle.length > 30 ? "..." : ""),
      model: model || defaultModel,
      created_at: now,
      updated_at: now,
    });
  }

  // 选择模型：图片需路由到支持视觉的模型
  let selectedModel = model || session.model || defaultModel;
  // 兜底：会话里若存的是旧模型名（如 claude-*），不在千问列表则回退默认模型
  if (!QWEN_MODELS.find((m) => m.modelId === selectedModel)) {
    console.log(`[Chat] 模型 ${selectedModel} 非千问模型，回退到默认: ${defaultModel}`);
    selectedModel = defaultModel;
  }
  if (hasImages && !QWEN_MODELS.find((m) => m.modelId === selectedModel)?.vision) {
    console.log(`[Chat] 图片输入，自动切换到视觉模型: ${DEFAULT_VISION_MODEL}`);
    selectedModel = DEFAULT_VISION_MODEL;
  }

  // 创建用户消息 ID 和助手消息 ID
  const userMessageId = uuidv4();
  const assistantMessageId = uuidv4();

  // 保存用户消息到数据库（图片/文档暂不持久化原文，仅存文本问题）
  try {
    const userContentForDb =
      (message || "") +
      (hasImages ? `\n[附 ${images.length} 张图片]` : "") +
      (mdDocs.length ? `\n[附 ${mdDocs.length} 个项目资料: ${mdDocs.map((d) => d.name).join("、")}]` : "");
    db.createMessage({
      id: userMessageId,
      session_id: session.id,
      role: "user",
      content: userContentForDb.trim() || "[图片/文件输入]",
      model: null,
      created_at: now,
      tool_calls: null,
    });
    console.log(`[Chat] 用户消息已保存: ${userMessageId}`);
  } catch (dbError: any) {
    console.error(`[Chat] 保存用户消息失败:`, dbError);
    return res.status(500).json({ error: "保存消息失败", detail: dbError?.message });
  }

  // 设置 SSE 头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // 发送会话ID和消息ID（前端据此映射消息）
  res.write(
    `data: ${JSON.stringify({
      type: "init",
      sessionId: session.id,
      userMessageId,
      assistantMessageId,
      model: selectedModel,
    })}\n\n`
  );

  // 组装对话历史（从数据库读取，保持多轮上下文）
  const history = db
    .getMessagesBySession(session.id)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  // 拼接本次用户输入（文本 + 图片 + 项目资料 .md）
  let userTurnContent: any = message || "";
  if (hasImages) {
    // 多模态：图片 + 文本
    const parts: any[] = images.map((url: string) => ({
      type: "image_url",
      image_url: { url },
    }));
    let textPart = message || "";
    if (mdDocs.length) {
      textPart +=
        "\n\n" + mdDocs.map((d) => `【用户上传的项目资料文件：${d.name}】\n${d.text}`).join("\n\n");
    }
    if (!textPart.trim()) {
      textPart = "请查看以上图片，回答用户的问题。";
    }
    parts.push({ type: "text", text: textPart });
    userTurnContent = parts;
  } else if (mdDocs.length) {
    let textPart = message || "";
    textPart +=
      "\n\n" + mdDocs.map((d) => `【用户上传的项目资料文件：${d.name}】\n${d.text}`).join("\n\n");
    if (!message || !message.trim()) {
      textPart +=
        "\n\n[任务] 以上项目资料已自动存入项目资料库。请简要说明这份资料的核心要点（关键规则、时间节点、入口路径等），并告诉用户它已存入知识库，以后相关活动可直接依据它回答。";
    }
    userTurnContent = textPart;
  }

  // 用富内容覆盖历史中最后一条（刚保存的）用户消息
  if (history.length > 0 && history[history.length - 1].role === "user") {
    history[history.length - 1].content = userTurnContent;
  } else {
    history.push({ role: "user", content: userTurnContent });
  }

  // 读取知识库并注入 system prompt
  const knowledgeContext = loadKnowledgeContext();
  const system = `${systemPrompt || defaultSystemPrompt}\n\n## 知识库内容\n${knowledgeContext}`;

  const apiMessages = [{ role: "system", content: system }, ...history];

  // 已上传的 .md 项目资料文件此前已写入知识库，下发 file_saved 事件（早于模型调用，确保即使回答失败也会提示）
  for (const f of savedFiles) {
    res.write(`data: ${JSON.stringify({ type: "file_saved", filename: f })}\n\n`);
  }

  let fullResponse = "";

  try {
    console.log(`[Chat] 调用千问: ${selectedModel}`);
    const upstream = await fetch(DASHSCOPE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: apiMessages,
        stream: true,
        temperature: 0.8,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const errText = await upstream.text().catch(() => "");
      let msg = "千问接口调用失败";
      try {
        const e = JSON.parse(errText);
        if (e?.message) msg = e.message;
      } catch {
        if (errText) msg = errText.slice(0, 200);
      }
      console.error(`[Chat] 千问错误: ${msg}`);
      res.write(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`);
      res.end();
      return;
    }

    // 解析千问的 SSE 流，翻译成前端需要的 {type:"text"} 事件
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // 保留未完成的半行

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullResponse += delta;
            res.write(`data: ${JSON.stringify({ type: "text", content: delta })}\n\n`);
          }
        } catch {
          // 忽略无法解析的行
        }
      }
    }
  } catch (error: any) {
    console.error(`\n[Chat] ========== 错误 ==========`);
    console.error(`[Chat] Error:`, error?.message);
    const errorMessage = error?.message || "处理请求时发生错误";
    res.write(`data: ${JSON.stringify({ type: "error", message: errorMessage })}\n\n`);
    res.end();
    return;
  }

  // 保存助手消息到数据库
  try {
    db.createMessage({
      id: assistantMessageId,
      session_id: session.id,
      role: "assistant",
      content: fullResponse,
      model: selectedModel,
      created_at: new Date().toISOString(),
      tool_calls: null,
    });

    // 更新会话标题（如果是第一条消息）
    const msgs = db.getMessagesBySession(session.id);
    if (msgs.length <= 2) {
      db.updateSession(session.id, {
        title: sessionTitle.slice(0, 30) + (sessionTitle.length > 30 ? "..." : ""),
        model: selectedModel,
      });
    }
  } catch (dbError: any) {
    console.error(`[Chat] 保存助手消息失败:`, dbError);
  }

  console.log(`[Chat] 请求完成 ✓`);
  res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  res.end();
});

// ============= 生产环境：同源托管前端静态文件 =============
// 部署时执行 `npm run build` 生成 dist/，由本服务同源托管，
// 这样「网页 + 接口」是同一个端口、同一个进程，避免 dev 代理 / 双进程冲突导致的断链。
// 开发模式（dist 不存在）此块自动跳过，不影响本地 npm run dev。
const DIST_DIR = path.join(__dirname, "..", "dist");
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  // SPA 路由兜底：所有非 /api 的请求都返回 index.html（支持前端路由刷新不 404）
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

// 启动服务器
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║     ◉ API 服务器已启动（千问 / DashScope） ║
║                                            ║
║     地址: http://localhost:${PORT}            ║
║     数据库: SQLite (data/chat.db)          ║
║     默认模型: ${defaultModel}               ║
║                                            ║
╚════════════════════════════════════════════╝
  `);
});
