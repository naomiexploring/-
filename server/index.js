var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _a;
import express from "express";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import fsp from "fs/promises";
import { fileURLToPath } from "url";
import * as db from "./db.js";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT || 3000;
// Middleware（提高 JSON 体积上限以允许前端以 base64 直接传图片/文档）
app.use(express.json({ limit: "50mb" }));
// ============= 千问 / DashScope 配置 =============
// 通义千问 OpenAI 兼容接口（无需任何 SDK，Node 自带 fetch 即可调用）
var DASHSCOPE_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
// 默认模型：用户指定 Qwen3.7，裸名不存在，使用旗舰文本模型 qwen3.7-max
var defaultModel = "qwen3.7-max";
// 可选模型列表（前端可切换）
// vision=true 表示该模型支持图片/多模态输入（截图问答需路由到这类模型）
var QWEN_MODELS = [
    { modelId: "qwen3.7-max", name: "通义千问 Qwen3.7-Max（旗舰·纯文本）" },
    { modelId: "qwen3.7-plus", name: "通义千问 Qwen3.7-Plus（视觉+文本）", vision: true },
    { modelId: "qwen3.7-flash", name: "通义千问 Qwen3.7-Flash（最便宜·纯文本）" },
    { modelId: "qwen3.6-plus", name: "通义千问 Qwen3.6-Plus（视觉+文本·备选）", vision: true },
];
// 第一个支持视觉的模型（图片自动路由到此）
var DEFAULT_VISION_MODEL = ((_a = QWEN_MODELS.find(function (m) { return m.vision; })) === null || _a === void 0 ? void 0 : _a.modelId) || "qwen3.7-plus";
// 健康检查
app.get("/api/health", function (req, res) {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// 验证用户的千问 / DashScope API Key 是否有效
app.post("/api/validate-key", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var apiKey, testRes, errText, msg, e, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                apiKey = req.body.apiKey;
                if (!apiKey || typeof apiKey !== "string") {
                    return [2 /*return*/, res.status(400).json({ valid: false, error: "请提供 API Key" })];
                }
                _a.label = 1;
            case 1:
                _a.trys.push([1, 5, , 6]);
                return [4 /*yield*/, fetch(DASHSCOPE_API_URL, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: "Bearer ".concat(apiKey),
                        },
                        body: JSON.stringify({
                            model: defaultModel,
                            messages: [{ role: "user", content: "ping" }],
                            max_tokens: 1,
                            stream: false,
                        }),
                    })];
            case 2:
                testRes = _a.sent();
                if (!!testRes.ok) return [3 /*break*/, 4];
                return [4 /*yield*/, testRes.text()];
            case 3:
                errText = _a.sent();
                msg = "API Key 无效";
                try {
                    e = JSON.parse(errText);
                    if (e === null || e === void 0 ? void 0 : e.message)
                        msg = e.message;
                }
                catch (_b) {
                    msg = errText.slice(0, 200);
                }
                return [2 /*return*/, res.json({ valid: false, error: "\u5343\u95EE API Key \u65E0\u6548\u6216\u989D\u5EA6\u4E0D\u8DB3\uFF1A".concat(msg) })];
            case 4:
                res.json({ valid: true, message: "千问 API Key 验证成功" });
                return [3 /*break*/, 6];
            case 5:
                error_1 = _a.sent();
                console.error("[Validate Key] Error:", error_1);
                res.json({
                    valid: false,
                    error: (error_1 === null || error_1 === void 0 ? void 0 : error_1.message) || "API Key 无效或网络错误，请检查后重试",
                });
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); });
// ============= 知识库管理 API =============
var KNOWLEDGE_BASE_DIR = path.join(__dirname, "..", "knowledge-base");
// 确保知识库目录存在
if (!fs.existsSync(KNOWLEDGE_BASE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_BASE_DIR, { recursive: true });
}
// 读取全部知识库内容，拼接成一段上下文字符串（注入到 system prompt）
function loadKnowledgeContext() {
    try {
        var files = fs
            .readdirSync(KNOWLEDGE_BASE_DIR)
            .filter(function (f) { return f.endsWith(".md"); })
            .sort();
        var parts = [];
        for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
            var f = files_1[_i];
            var content = fs.readFileSync(path.join(KNOWLEDGE_BASE_DIR, f), "utf-8");
            parts.push("### \u6587\u4EF6\uFF1A".concat(f, "\n\n").concat(content));
        }
        return parts.join("\n\n");
    }
    catch (e) {
        console.error("[Knowledge] load error:", e);
        return "";
    }
}
// ============= FAQ 整理：去重 / 就地优化 / 精简 / 清理话术 =============
// 命中即视为 UI 交互话术的关键词（整段删掉）
var CTA_KEYWORDS = [
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
function stripCtaPhrases(text) {
    if (!text)
        return text;
    var out = text;
    // 1) 整段柔性匹配：📌 请选择：... 直到 存入案例库/我会存入案例库 之后
    out = out.replace(/📌?\s*请选择[：:][\s\S]*?(?:存入案例库|我会存入案例库)[\s\S]{0,30}/gu, "");
    // 2) 逐行删除含 CTA 关键词的行
    out = out
        .split("\n")
        .filter(function (line) {
        var l = line.trim();
        if (!l)
            return true;
        return !CTA_KEYWORDS.some(function (k) { return l.includes(k); });
    })
        .join("\n");
    // 3) 清理被删空后的孤立行号（如 "1." "2. "）
    out = out.replace(/^\s*\d+\.\s*$/gm, "");
    // 4) 折叠多余空行
    out = out.replace(/\n{3,}/g, "\n\n").trim();
    return out;
}
// 去除 emoji / 表情符号（保留中文、标点与换行结构）
function stripEmoji(text) {
    if (!text)
        return text;
    return text
        .replace(/\p{Extended_Pictographic}/gu, "")
        .replace(/[\u200D\uFE00-\uFE0F]/g, "")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
}
// 非流式调用千问，返回纯文本
function callQwenText(apiKey_1, messages_1) {
    return __awaiter(this, arguments, void 0, function (apiKey, messages, model) {
        var res, errText, data;
        var _a, _b, _c;
        if (model === void 0) { model = defaultModel; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, fetch(DASHSCOPE_API_URL, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: "Bearer ".concat(apiKey),
                        },
                        body: JSON.stringify({
                            model: model,
                            messages: messages,
                            max_tokens: 4096,
                            temperature: 0.2,
                            stream: false,
                        }),
                    })];
                case 1:
                    res = _d.sent();
                    if (!!res.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, res.text()];
                case 2:
                    errText = _d.sent();
                    throw new Error("DashScope ".concat(res.status, ": ").concat(errText.slice(0, 200)));
                case 3: return [4 /*yield*/, res.json()];
                case 4:
                    data = _d.sent();
                    return [2 /*return*/, ((_c = (_b = (_a = data === null || data === void 0 ? void 0 : data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || ""];
            }
        });
    });
}
// 用千问整理 FAQ：语义去重 + 就地优化 + 精简 + 去 CTA/emoji + 格式归一，返回完整文件
function mergeFaqWithModel(apiKey, existing, question, draftAnswer) {
    return __awaiter(this, void 0, void 0, function () {
        var sysPrompt, userPrompt, text, cleaned;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sysPrompt = "\u4F60\u8D1F\u8D23\u7EF4\u62A4\u4E00\u4E2A Markdown \u683C\u5F0F\u7684 FAQ \u77E5\u8BC6\u5E93\u6587\u4EF6\u3002\u8BE5\u6587\u4EF6\u5F53\u524D\u4F7F\u7528\u7684\u683C\u5F0F\u662F\uFF1A\n- \u9876\u90E8\u4E00\u884C\u6807\u9898\uFF08\u4EE5 # \u5F00\u5934\uFF09\n- \u7AE0\u8282\u7528 \"## N. \u7AE0\u8282\u540D\" \u5206\u9694\n- \u6BCF\u4E2A\u95EE\u9898\u5199\u6210 \"**Q\uFF1A\u95EE\u9898\u6587\u5B57**\"\uFF0C\u7D27\u8DDF\u5176\u540E\u662F \"A\uFF1A\u56DE\u7B54\u6587\u5B57\"\uFF1B\u4E00\u4E2A\u7AE0\u8282\u5185\u53EF\u6709\u591A\u4E2A\u95EE\u7B54\u8FDE\u7EED\u6392\u5217\n\u8BF7\u4E25\u683C\u9075\u5B88\uFF1A\n1. \u82E5\u6587\u4EF6\u4E2D\u5DF2\u5B58\u5728\u76F8\u540C\u6216\u8BED\u4E49\u7B49\u4EF7\u7684\u95EE\u9898\uFF08\u65E0\u8BBA\u5B83\u5728\u54EA\u4E00\u884C\uFF09\uFF0C\u8BF7\u5728\u539F\u4F4D\u7F6E\u5C31\u5730\u4F18\u5316/\u66F4\u65B0\u5176\u5BF9\u5E94\u7684 A\uFF1A\u56DE\u7B54\uFF0C\u4E0D\u8981\u65B0\u589E\u91CD\u590D\u95EE\u7B54\u3002\n2. \u82E5\u662F\u5168\u65B0\u95EE\u9898\uFF0C\u8BF7\u628A\u65B0\u95EE\u7B54\u8FFD\u52A0\u5230\u6700\u76F8\u5173\u7684\u5DF2\u6709\u7AE0\u8282\u672B\u5C3E\uFF1B\u82E5\u90FD\u4E0D\u76F8\u5173\uFF0C\u5219\u5728\u6587\u4EF6\u672B\u5C3E\u65B0\u5EFA\u4E00\u4E2A \"## N. \u65B0\u7AE0\u8282\" \u518D\u653E\u8FDB\u53BB\u3002\u65B0\u95EE\u7B54\u683C\u5F0F\u5FC5\u987B\u4E3A \"**Q\uFF1A\u95EE\u9898**\" \u6362\u884C \"A\uFF1A\u56DE\u7B54\"\u3002\n3. \u6240\u6709\u56DE\u7B54\u5FC5\u987B\u7B80\u660E\u3001\u4E13\u4E1A\u3001\u53E3\u8BED\u5316\u9002\u5EA6\uFF1B\u53BB\u9664 emoji/\u8868\u60C5\u7B26\u53F7\uFF0C\u4EE5\u53CA\u4EFB\u4F55 UI \u4EA4\u4E92\u8BDD\u672F\uFF08\u5982\"\u5C31\u8FD9\u4E48\u56DE\u7B54\"\"\u91CD\u65B0\u56DE\u7B54\"\"\u5B66\u4E60\u6211\u7684\u56DE\u7B54\"\"\u91C7\u7EB3\u6B64\u56DE\u7B54\"\"\u81EA\u52A8\u5199\u5165FAQ\"\"\u544A\u8BC9\u6211\u5E0C\u671B\u8C03\u6574\u7684\u65B9\u5411\"\"\u53D1\u9001\u4F60\u7684\u56DE\u7B54\"\u7B49\uFF09\u3002\n4. \u7EDD\u5BF9\u4E0D\u8981\u628A\u4EFB\u4F55 UI \u4EA4\u4E92\u8BDD\u672F\u5199\u8FDB\u77E5\u8BC6\u5E93\u3002\n5. \u4FDD\u7559\u4E0E\u672C\u6B21\u95EE\u9898\u65E0\u5173\u7684\u5176\u4ED6\u5DF2\u6709\u95EE\u7B54\uFF1B\u5BF9\u5B83\u4EEC\u4EC5\u505A\u5FC5\u8981\u7684\u683C\u5F0F\u6E05\u7406\uFF1A\u53BB\u6389 emoji\u3001\u53BB\u6389 \"\u66F4\u65B0\u4E8E ...\" \u8FD9\u7C7B\u65F6\u95F4\u6233\u884C\u3001\u628A\u65E7\u5199\u6CD5 \"**\u56DE\u7B54\uFF1A**\" \u7EDF\u4E00\u6539\u4E3A \"A\uFF1A\"\u3002\n6. \u53EA\u8F93\u51FA\u66F4\u65B0\u540E\u7684\u3010\u5B8C\u6574\u6587\u4EF6\u5185\u5BB9\u3011\uFF0C\u4E0D\u8981\u7528\u4EE3\u7801\u5757\u56F4\u680F\u5305\u88F9\uFF0C\u4E0D\u8981\u4EFB\u4F55\u989D\u5916\u8BF4\u660E\u3002";
                    userPrompt = "\u3010\u5F53\u524D FAQ \u6587\u4EF6\u5185\u5BB9\u3011\n".concat(existing || "（空文件）", "\n\n\u3010\u5F85\u6574\u7406\u7684\u65B0\u95EE\u7B54\u3011\n\u95EE\u9898\uFF1A").concat(question, "\n\u8349\u7A3F\u56DE\u7B54\uFF08\u53EF\u80FD\u542B\u53E3\u8BED/emoji/UI\u8BDD\u672F\uFF0C\u8BF7\u6574\u7406\u4E3A\u7B80\u660E\u7248\u672C\uFF09\uFF1A").concat(draftAnswer, "\n\n\u8BF7\u8FD4\u56DE\u6574\u7406\u540E\u7684\u5B8C\u6574 FAQ \u6587\u4EF6\u5185\u5BB9\u3002");
                    return [4 /*yield*/, callQwenText(apiKey, [
                            { role: "system", content: sysPrompt },
                            { role: "user", content: userPrompt },
                        ])];
                case 1:
                    text = _a.sent();
                    cleaned = text
                        .trim()
                        .replace(/^```(?:markdown)?\s*/i, "")
                        .replace(/\s*```$/i, "")
                        .trim();
                    if (!cleaned)
                        throw new Error("模型返回为空");
                    // 二次保险：再清一遍 CTA 与 emoji（注意：只清字符，不压缩换行）
                    cleaned = stripEmoji(stripCtaPhrases(cleaned));
                    return [2 /*return*/, cleaned];
            }
        });
    });
}
// 规则兜底去重：精确匹配 **Q：问题**，命中则就地替换该条目，否则追加到末尾
function mergeFaqRuleBased(existing, question, cleanAnswer) {
    var qNorm = question.trim();
    // 与现有 FAQ 保持一致：**Q：问题** 换行 A：回答
    var newEntry = "**Q\uFF1A".concat(qNorm, "**\n\nA\uFF1A").concat(cleanAnswer, "\n");
    var lines = existing.split("\n");
    var foundIdx = -1;
    for (var i = 0; i < lines.length; i++) {
        var m = lines[i].match(/^\s*\*\*Q[:：]\s*(.*?)\s*\*\*/u);
        if (m && m[1].trim() === qNorm) {
            foundIdx = i;
            break;
        }
    }
    if (foundIdx >= 0) {
        // 找到该问答的结束位置：下一个 **Q： 或 ## 章节 或 --- 分隔线
        var endIdx = lines.length;
        for (var j = foundIdx + 1; j < lines.length; j++) {
            if (/^\s*\*\*Q[:：]/.test(lines[j]) ||
                /^\s*##\s/.test(lines[j]) ||
                /^\s*---\s*$/.test(lines[j])) {
                endIdx = j;
                break;
            }
        }
        lines.splice(foundIdx, endIdx - foundIdx, newEntry.trimEnd());
        return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
    }
    // 不存在则追加到末尾
    var sep = /---\s*$/.test(existing.trim()) ? "\n\n" : (existing.trim() ? "\n\n---\n\n" : "");
    return (existing.trim() + sep + newEntry).replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
// ============= 多模态 / 文档解析辅助函数 =============
// 把 "data:image/png;base64,xxxx" 解码为 { mime, buffer }
function decodeDataUrl(dataUrl) {
    var commaIdx = dataUrl.indexOf(",");
    if (commaIdx === -1) {
        return { mime: "application/octet-stream", buffer: Buffer.from(dataUrl, "base64") };
    }
    var meta = dataUrl.slice(0, commaIdx); // data:image/png;base64
    var mimeMatch = meta.match(/data:([^;]+)/);
    var mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
    var base64 = dataUrl.slice(commaIdx + 1);
    return { mime: mime, buffer: Buffer.from(base64, "base64") };
}
// 仅支持 .md 项目资料文件：直接解码为 UTF-8 文本后写入知识库（见 /api/chat 预处理段）
// 不再解析 PDF / Word / PPT 等二进制格式
// 列出所有知识库文件
app.get("/api/knowledge", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var files, fileDetails, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                return [4 /*yield*/, fsp.readdir(KNOWLEDGE_BASE_DIR)];
            case 1:
                files = _a.sent();
                return [4 /*yield*/, Promise.all(files
                        .filter(function (f) { return f.endsWith(".md"); })
                        .map(function (f) { return __awaiter(void 0, void 0, void 0, function () {
                        var filePath, stat, content, lines;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    filePath = path.join(KNOWLEDGE_BASE_DIR, f);
                                    return [4 /*yield*/, fsp.stat(filePath)];
                                case 1:
                                    stat = _a.sent();
                                    return [4 /*yield*/, fsp.readFile(filePath, "utf-8")];
                                case 2:
                                    content = _a.sent();
                                    lines = content.split("\n");
                                    return [2 /*return*/, {
                                            filename: f,
                                            size: stat.size,
                                            lineCount: lines.length,
                                            wordCount: content.length,
                                            preview: content.slice(0, 200) + (content.length > 200 ? "..." : ""),
                                            updatedAt: stat.mtime.toISOString(),
                                        }];
                            }
                        });
                    }); }))];
            case 2:
                fileDetails = _a.sent();
                res.json({ files: fileDetails.sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); }) });
                return [3 /*break*/, 4];
            case 3:
                error_2 = _a.sent();
                console.error("[Knowledge] List error:", error_2);
                res.status(500).json({ error: (error_2 === null || error_2 === void 0 ? void 0 : error_2.message) || "获取知识库列表失败" });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// 知识库统计（必须在 :filename 路由之前定义）
app.get("/api/knowledge/stats", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var files, mdFiles, totalSize, totalLines, totalWords, fileStats, _i, mdFiles_1, f, filePath, stat, content, error_3;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 7, , 8]);
                return [4 /*yield*/, fsp.readdir(KNOWLEDGE_BASE_DIR)];
            case 1:
                files = _a.sent();
                mdFiles = files.filter(function (f) { return f.endsWith(".md"); });
                totalSize = 0;
                totalLines = 0;
                totalWords = 0;
                fileStats = [];
                _i = 0, mdFiles_1 = mdFiles;
                _a.label = 2;
            case 2:
                if (!(_i < mdFiles_1.length)) return [3 /*break*/, 6];
                f = mdFiles_1[_i];
                filePath = path.join(KNOWLEDGE_BASE_DIR, f);
                return [4 /*yield*/, fsp.stat(filePath)];
            case 3:
                stat = _a.sent();
                return [4 /*yield*/, fsp.readFile(filePath, "utf-8")];
            case 4:
                content = _a.sent();
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
                _a.label = 5;
            case 5:
                _i++;
                return [3 /*break*/, 2];
            case 6:
                res.json({
                    totalFiles: mdFiles.length,
                    totalSize: totalSize,
                    totalLines: totalLines,
                    totalWords: totalWords,
                    files: fileStats.sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); }),
                });
                return [3 /*break*/, 8];
            case 7:
                error_3 = _a.sent();
                console.error("[Knowledge] Stats error:", error_3);
                res.status(500).json({ error: (error_3 === null || error_3 === void 0 ? void 0 : error_3.message) || "获取统计失败" });
                return [3 /*break*/, 8];
            case 8: return [2 /*return*/];
        }
    });
}); });
// 获取单个知识库文件内容
app.get("/api/knowledge/:filename", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var filename, filePath, content, stat, error_4;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                filename = req.params.filename;
                filePath = path.join(KNOWLEDGE_BASE_DIR, path.basename(filename));
                if (!fs.existsSync(filePath)) {
                    return [2 /*return*/, res.status(404).json({ error: "文件不存在" })];
                }
                return [4 /*yield*/, fsp.readFile(filePath, "utf-8")];
            case 1:
                content = _a.sent();
                return [4 /*yield*/, fsp.stat(filePath)];
            case 2:
                stat = _a.sent();
                res.json({
                    filename: filename,
                    content: content,
                    size: stat.size,
                    updatedAt: stat.mtime.toISOString(),
                });
                return [3 /*break*/, 4];
            case 3:
                error_4 = _a.sent();
                console.error("[Knowledge] Read error:", error_4);
                res.status(500).json({ error: (error_4 === null || error_4 === void 0 ? void 0 : error_4.message) || "读取知识库文件失败" });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// 新增/追加知识库内容
app.post("/api/knowledge", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, filename, content, mode, safeName, filePath, timestamp, header, stat, error_5;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 6, , 7]);
                _a = req.body, filename = _a.filename, content = _a.content, mode = _a.mode;
                if (!filename || !content) {
                    return [2 /*return*/, res.status(400).json({ error: "文件名和内容不能为空" })];
                }
                safeName = path.basename(filename).replace(/[^a-zA-Z0-9一-龥._-]/g, "");
                if (!safeName.endsWith(".md")) {
                    return [2 /*return*/, res.status(400).json({ error: "只支持 .md 文件" })];
                }
                filePath = path.join(KNOWLEDGE_BASE_DIR, safeName);
                timestamp = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
                if (!(mode === "overwrite")) return [3 /*break*/, 2];
                return [4 /*yield*/, fsp.writeFile(filePath, content, "utf-8")];
            case 1:
                _b.sent();
                return [3 /*break*/, 4];
            case 2:
                header = "\n\n---\n\n> \uD83D\uDCE5 \u65B0\u589E\u4E8E ".concat(timestamp, "\n\n");
                return [4 /*yield*/, fsp.appendFile(filePath, header + content + "\n", "utf-8")];
            case 3:
                _b.sent();
                _b.label = 4;
            case 4: return [4 /*yield*/, fsp.stat(filePath)];
            case 5:
                stat = _b.sent();
                res.json({
                    success: true,
                    filename: safeName,
                    message: mode === "overwrite" ? "文件已更新" : "内容已追加",
                    size: stat.size,
                    updatedAt: stat.mtime.toISOString(),
                });
                return [3 /*break*/, 7];
            case 6:
                error_5 = _b.sent();
                console.error("[Knowledge] Add error:", error_5);
                res.status(500).json({ error: (error_5 === null || error_5 === void 0 ? void 0 : error_5.message) || "添加知识库内容失败" });
                return [3 /*break*/, 7];
            case 7: return [2 /*return*/];
        }
    });
}); });
// 创建新知识库文件
app.post("/api/knowledge/create", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, filename, content, description, safeName, finalName, filePath, timestamp, header, error_6;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                _a = req.body, filename = _a.filename, content = _a.content, description = _a.description;
                if (!filename) {
                    return [2 /*return*/, res.status(400).json({ error: "文件名不能为空" })];
                }
                safeName = path.basename(filename).replace(/[^a-zA-Z0-9一-龥._-]/g, "");
                if (!safeName.endsWith(".md")) {
                    safeName + ".md";
                }
                finalName = safeName.endsWith(".md") ? safeName : safeName + ".md";
                filePath = path.join(KNOWLEDGE_BASE_DIR, finalName);
                if (fs.existsSync(filePath)) {
                    return [2 /*return*/, res.status(409).json({ error: "文件已存在" })];
                }
                timestamp = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
                header = "# ".concat(description || finalName.replace(".md", ""), "\n\n> \u521B\u5EFA\u4E8E ").concat(timestamp, "\n\n");
                return [4 /*yield*/, fsp.writeFile(filePath, header + (content || ""), "utf-8")];
            case 1:
                _b.sent();
                res.json({ success: true, filename: finalName, message: "文件创建成功" });
                return [3 /*break*/, 3];
            case 2:
                error_6 = _b.sent();
                console.error("[Knowledge] Create error:", error_6);
                res.status(500).json({ error: (error_6 === null || error_6 === void 0 ? void 0 : error_6.message) || "创建知识库文件失败" });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// 删除知识库文件
app.delete("/api/knowledge/:filename", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var filename, safeName, filePath, error_7;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                filename = req.params.filename;
                safeName = path.basename(filename);
                filePath = path.join(KNOWLEDGE_BASE_DIR, safeName);
                if (!fs.existsSync(filePath)) {
                    return [2 /*return*/, res.status(404).json({ error: "文件不存在" })];
                }
                return [4 /*yield*/, fsp.unlink(filePath)];
            case 1:
                _a.sent();
                res.json({ success: true, message: "\u5DF2\u5220\u9664 ".concat(safeName) });
                return [3 /*break*/, 3];
            case 2:
                error_7 = _a.sent();
                console.error("[Knowledge] Delete error:", error_7);
                res.status(500).json({ error: (error_7 === null || error_7 === void 0 ? void 0 : error_7.message) || "删除知识库文件失败" });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// 学习问答对（核心：自动更新知识库）
app.post("/api/learn", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, type, question, answer, userAnswer, category, timestamp, entry, faqPath, existing, apiKey, updated, e_1, cleanDraft, merged, casePath, raw, clean, caseContent, targetFile, safeName, finalName, filePath, header, error_8;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 20, , 21]);
                _a = req.body, type = _a.type, question = _a.question, answer = _a.answer, userAnswer = _a.userAnswer, category = _a.category;
                if (!question) {
                    return [2 /*return*/, res.status(400).json({ error: "问题不能为空" })];
                }
                timestamp = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
                entry = "\n\n---\n\n## ".concat(question, "\n\n> \u66F4\u65B0\u4E8E ").concat(timestamp, "\n\n");
                if (!(type === "accept_answer")) return [3 /*break*/, 9];
                faqPath = path.join(KNOWLEDGE_BASE_DIR, "代理人FAQ.md");
                existing = "";
                if (!fs.existsSync(faqPath)) return [3 /*break*/, 2];
                return [4 /*yield*/, fsp.readFile(faqPath, "utf-8")];
            case 1:
                existing = _b.sent();
                _b.label = 2;
            case 2:
                apiKey = req.body.apiKey;
                if (!apiKey) return [3 /*break*/, 7];
                _b.label = 3;
            case 3:
                _b.trys.push([3, 6, , 7]);
                return [4 /*yield*/, mergeFaqWithModel(apiKey, existing, question, answer || "")];
            case 4:
                updated = _b.sent();
                // 整文件再清一遍（连历史脏数据里的 CTA/emoji 也一并去除）
                return [4 /*yield*/, fsp.writeFile(faqPath, stripEmoji(stripCtaPhrases(updated)), "utf-8")];
            case 5:
                // 整文件再清一遍（连历史脏数据里的 CTA/emoji 也一并去除）
                _b.sent();
                return [2 /*return*/, res.json({
                        success: true,
                        message: "已整理并更新 FAQ 知识库（去重/精简）",
                        savedTo: "代理人FAQ.md",
                    })];
            case 6:
                e_1 = _b.sent();
                console.error("[Learn] 模型整理失败，改用规则兜底：", e_1);
                return [3 /*break*/, 7];
            case 7:
                cleanDraft = stripEmoji(stripCtaPhrases(answer || ""));
                merged = mergeFaqRuleBased(existing, question, cleanDraft);
                // 整文件再清一遍（连历史脏数据里的 CTA/emoji 也一并去除）
                return [4 /*yield*/, fsp.writeFile(faqPath, stripEmoji(stripCtaPhrases(merged)), "utf-8")];
            case 8:
                // 整文件再清一遍（连历史脏数据里的 CTA/emoji 也一并去除）
                _b.sent();
                res.json({
                    success: true,
                    message: "已保存到 FAQ 知识库",
                    savedTo: "代理人FAQ.md",
                });
                return [3 /*break*/, 19];
            case 9:
                if (!(type === "learn_answer")) return [3 /*break*/, 13];
                casePath = path.join(KNOWLEDGE_BASE_DIR, "问答案例库.md");
                raw = userAnswer || answer || "";
                clean = stripEmoji(stripCtaPhrases(raw));
                caseContent = "";
                if (!fs.existsSync(casePath)) return [3 /*break*/, 11];
                return [4 /*yield*/, fsp.readFile(casePath, "utf-8")];
            case 10:
                caseContent = _b.sent();
                _b.label = 11;
            case 11:
                caseContent = caseContent + entry + "**Greta \u98CE\u683C\u56DE\u7B54\uFF1A**\n\n".concat(clean, "\n");
                return [4 /*yield*/, fsp.writeFile(casePath, stripEmoji(stripCtaPhrases(caseContent)), "utf-8")];
            case 12:
                _b.sent();
                res.json({
                    success: true,
                    message: "已将你的回答保存到案例库",
                    savedTo: "问答案例库.md",
                });
                return [3 /*break*/, 19];
            case 13:
                if (!(type === "add_material")) return [3 /*break*/, 18];
                targetFile = category || "项目资料库.md";
                safeName = path.basename(targetFile).replace(/[^a-zA-Z0-9一-龥._-]/g, "");
                finalName = safeName.endsWith(".md") ? safeName : safeName + ".md";
                filePath = path.join(KNOWLEDGE_BASE_DIR, finalName);
                if (!fs.existsSync(filePath)) return [3 /*break*/, 15];
                return [4 /*yield*/, fsp.appendFile(filePath, entry + answer + "\n", "utf-8")];
            case 14:
                _b.sent();
                res.json({ success: true, message: "\u5DF2\u8FFD\u52A0\u5230 ".concat(finalName), savedTo: finalName });
                return [3 /*break*/, 17];
            case 15:
                header = "# ".concat(finalName.replace(".md", ""), "\n\n> \u521B\u5EFA\u4E8E ").concat(timestamp, "\n\n");
                return [4 /*yield*/, fsp.writeFile(filePath, header + answer + "\n", "utf-8")];
            case 16:
                _b.sent();
                res.json({ success: true, message: "\u5DF2\u521B\u5EFA\u65B0\u6587\u4EF6 ".concat(finalName), savedTo: finalName });
                _b.label = 17;
            case 17: return [3 /*break*/, 19];
            case 18:
                res.status(400).json({ error: "未知的学习类型" });
                _b.label = 19;
            case 19: return [3 /*break*/, 21];
            case 20:
                error_8 = _b.sent();
                console.error("[Learn] Error:", error_8);
                res.status(500).json({ error: (error_8 === null || error_8 === void 0 ? void 0 : error_8.message) || "学习失败" });
                return [3 /*break*/, 21];
            case 21: return [2 /*return*/];
        }
    });
}); });
// 获取可用模型列表（千问模型，静态返回，无需调用 API）
app.get("/api/models", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        try {
            res.json({
                models: QWEN_MODELS,
                defaultModel: defaultModel,
            });
        }
        catch (error) {
            console.error("[Models] Error:", error);
            res.json({ models: QWEN_MODELS, defaultModel: defaultModel });
        }
        return [2 /*return*/];
    });
}); });
// ============= 会话 API =============
// 获取所有会话（包含消息数量）
app.get("/api/sessions", function (req, res) {
    try {
        var sessions = db.getAllSessions();
        var sessionsWithMessages = sessions.map(function (session) {
            var messages = db.getMessagesBySession(session.id);
            return __assign(__assign({}, session), { messageCount: messages.length });
        });
        res.json({ sessions: sessionsWithMessages });
    }
    catch (error) {
        console.error("[Sessions] Error:", error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "获取会话失败" });
    }
});
// 获取单个会话及其消息
app.get("/api/sessions/:sessionId", function (req, res) {
    try {
        var sessionId = req.params.sessionId;
        var session = db.getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: "会话不存在" });
        }
        var messages = db.getMessagesBySession(sessionId);
        // 解析 tool_calls JSON
        var parsedMessages = messages.map(function (msg) { return (__assign(__assign({}, msg), { tool_calls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null })); });
        res.json({ session: session, messages: parsedMessages });
    }
    catch (error) {
        console.error("[Session] Error:", error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "获取会话失败" });
    }
});
// 创建新会话
app.post("/api/sessions", function (req, res) {
    try {
        var _a = req.body, _b = _a.model, model = _b === void 0 ? defaultModel : _b, _c = _a.title, title = _c === void 0 ? "新对话" : _c;
        var now = new Date().toISOString();
        var session = db.createSession({
            id: uuidv4(),
            title: title,
            model: model,
            created_at: now,
            updated_at: now,
        });
        res.json({ session: session });
    }
    catch (error) {
        console.error("[Create Session] Error:", error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "创建会话失败" });
    }
});
// 更新会话
app.patch("/api/sessions/:sessionId", function (req, res) {
    try {
        var sessionId = req.params.sessionId;
        var _a = req.body, title = _a.title, model = _a.model;
        var success = db.updateSession(sessionId, { title: title, model: model });
        if (!success) {
            return res.status(404).json({ error: "会话不存在" });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("[Update Session] Error:", error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "更新会话失败" });
    }
});
// 删除会话
app.delete("/api/sessions/:sessionId", function (req, res) {
    try {
        var sessionId = req.params.sessionId;
        var success = db.deleteSession(sessionId);
        if (!success) {
            return res.status(404).json({ error: "会话不存在" });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("[Delete Session] Error:", error);
        res.status(500).json({ error: (error === null || error === void 0 ? void 0 : error.message) || "删除会话失败" });
    }
});
// ============= 聊天 API（千问 / DashScope） =============
// 默认系统提示词 — Greta 风格保险代理人问答助手
// 注意：知识库由后端注入到下方「知识库内容」段落，模型无需调用任何工具
var defaultSystemPrompt = "\u4F60\u662F Greta\uFF08\u7C7D\u7C7D\uFF09\uFF0C\u5927\u90FD\u4F1A\u4EBA\u5BFF\u7684\u6D3B\u52A8/\u4EA7\u54C1\u8FD0\u8425 owner\uFF0C\u8D1F\u8D23\u5BF9\u63A5\u4E00\u7EBF\u4FDD\u9669\u4EE3\u7406\u4EBA\u3002\n\n## \u6838\u5FC3\u8EAB\u4EFD\n\u4F60\u5BF9\u63A5\u7684\u4EE3\u7406\u4EBA\u5728\u4F7F\u7528 iAgent \u5E73\u53F0\u7684 Care Plus \u5BA2\u6237\u4E92\u52A8\u6D3B\u52A8\uFF08\u751F\u65E5\u52A0\u4FDD\u3001\u9996\u5468\u5E74\u68C0\u89C6\u3001\u65B0\u5BA2\u4F53\u9A8C\u3001\u90FD\u4F1A\u5C0A\u4EAB\u3001\u513F\u7AE5 H5 \u793C\u9047\u7B49\uFF09\u3002\u4F60\u7684\u804C\u8D23\u662F\u56DE\u7B54\u4ED6\u4EEC\u5173\u4E8E\u6D3B\u52A8\u64CD\u4F5C\u3001\u89C4\u5219\u3001\u62A5\u9519\u3001\u9886\u53D6\u7B49\u65B9\u9762\u7684\u7591\u95EE\uFF0C\u98CE\u683C\u4EB2\u5207\u3001\u53E3\u8BED\u5316\u3001\u50CF\u642D\u6863\u4E00\u6837\u3002\n\n## \u77E5\u8BC6\u5E93\uFF08\u5DF2\u81EA\u52A8\u6CE8\u5165\uFF0C\u65E0\u9700\u4F60\u8BFB\u53D6\u6587\u4EF6\uFF09\n\u4E0B\u9762\u300C\u77E5\u8BC6\u5E93\u5185\u5BB9\u300D\u6BB5\u843D\u662F\u7CFB\u7EDF\u81EA\u52A8\u9644\u4E0A\u7684\u6700\u65B0\u8D44\u6599\uFF0C\u8BF7\u57FA\u4E8E\u5B83\u56DE\u7B54\u3002\u5305\u542B\uFF1A\n- \u4EE3\u7406\u4EBAFAQ.md \u2014 \u5E38\u89C1\u95EE\u9898\u4E0E\u53C2\u8003\u7B54\u6848\n- \u95EE\u7B54\u6848\u4F8B\u5E93.md \u2014 Greta \u7684\u771F\u5B9E\u56DE\u7B54\u8303\u5F0F\uFF08\u6A21\u4EFF\u98CE\u683C\u7528\uFF09\n- style_guide.md \u2014 \u56DE\u7B54\u98CE\u683C\u89C4\u8303\uFF08\u786C\u7EA6\u675F\uFF09\n- \u4EE3\u7406\u4EBA\u753B\u50CF.md / \u4EE3\u7406\u4EBA\u4EBA\u8BBE.md \u2014 \u4EE3\u7406\u4EBA\u5178\u578B\u4EBA\u8BBE\u56FE\u8C31\n- \u804A\u5929\u8BB0\u5F55.md \u2014 Greta \u4E0E\u4EE3\u7406\u4EBA\u7684\u771F\u5B9E\u5FAE\u4FE1\u6C9F\u901A\u8BB0\u5F55\n- \u9879\u76EE\u8D44\u6599\u5E93.md \u2014 \u9879\u76EE\u6700\u65B0\u8D44\u6599\uFF08\u5982\u6709\uFF09\n\n\u68C0\u7D22\u4F18\u5148\u7EA7\uFF1A\u9879\u76EE\u8D44\u6599\u5E93 > FAQ\u5E93 > \u6848\u4F8B\u5E93\u3002\u5982\u679C\u77E5\u8BC6\u5E93\u4E2D\u65E0\u76F8\u5173\u5185\u5BB9\uFF0C\u56DE\u7B54\uFF1A\"\u76EE\u524D\u77E5\u8BC6\u5E93\u4E2D\u6682\u65E0\u76F8\u5173\u8D44\u6599\uFF0C\u4EE5\u4E0B\u662F\u57FA\u4E8E\u901A\u7528\u77E5\u8BC6\u7684\u53C2\u8003\u56DE\u7B54\uFF1A\u2026\u2026\" \u5E76\u6807\u6CE8 \"\u26A0\uFE0F \u6B64\u56DE\u7B54\u672A\u7ECF\u77E5\u8BC6\u5E93\u9A8C\u8BC1\uFF0C\u5EFA\u8BAE\u6838\u5B9E\u540E\u4F7F\u7528\"\u3002\n\n## \u591A\u6A21\u6001\u8F93\u5165\uFF08\u56FE\u7247 / \u9879\u76EE\u8D44\u6599\uFF09\n- \u7528\u6237\u53EF\u80FD\u76F4\u63A5\u53D1\u6765\u4E00\u5F20\u5FAE\u4FE1\u622A\u56FE\u95EE\u95EE\u9898\uFF08\u5982\u6D3B\u52A8\u62A5\u9519\u3001\u9875\u9762\u6837\u5F0F\u3001\u89C4\u5219\u7591\u95EE\uFF09\uFF0C\u8BF7\u7ED3\u5408\u56FE\u7247\u5185\u5BB9\u76F4\u63A5\u56DE\u7B54\uFF0C\u5E76\u5728\u9700\u8981\u65F6\u7ED9\u51FA\u8DEF\u5F84/\u5165\u53E3\n- \u7528\u6237\u4F1A\u4E0A\u4F20 .md \u683C\u5F0F\u7684\u9879\u76EE\u8D44\u6599\u6587\u4EF6\uFF0C\u5BF9\u8BDD\u91CC\u4F1A\u51FA\u73B0\u300C\u7528\u6237\u4E0A\u4F20\u7684\u9879\u76EE\u8D44\u6599\u6587\u4EF6\u300D\u533A\u5757\uFF1B\u7CFB\u7EDF\u5DF2\u81EA\u52A8\u628A\u8BE5\u6587\u4EF6\u5B58\u5165\u9879\u76EE\u8D44\u6599\u5E93\uFF0C\u8BF7\u57FA\u4E8E\u5176\u5185\u5BB9\u56DE\u7B54\u7528\u6237\u95EE\u9898\uFF0C\u5E76\u53EF\u5728\u7528\u6237\u65E0\u989D\u5916\u95EE\u9898\u65F6\u7B80\u8981\u8BF4\u660E\u8D44\u6599\u8981\u70B9\n\n## \u81EA\u52A8\u5B66\u4E60\u4E0E\u77E5\u8BC6\u66F4\u65B0\uFF08\u7531\u7CFB\u7EDF\u81EA\u52A8\u5B8C\u6210\uFF0C\u4F60\u65E0\u9700\u64CD\u4F5C\u6587\u4EF6\uFF09\n- \u5F53\u7528\u6237\u9009\u62E9\u300C\u5C31\u8FD9\u4E48\u56DE\u7B54\u300D\u65F6\uFF0C\u7CFB\u7EDF\u4F1A\u81EA\u52A8\u628A\u8BE5\u95EE\u7B54\u5B58\u5165 FAQ \u77E5\u8BC6\u5E93\uFF1B\n- \u5F53\u7528\u6237\u9009\u62E9\u300C\u5B66\u4E60\u6211\u7684\u56DE\u7B54\u300D\u65F6\uFF0C\u7CFB\u7EDF\u4F1A\u81EA\u52A8\u628A\u7528\u6237\u7684\u56DE\u7B54\u5B58\u5165\u6848\u4F8B\u5E93\uFF1B\n- \u9047\u5230\u77E5\u8BC6\u5E93\u4E2D\u6CA1\u6709\u7684\u65B0\u95EE\u9898\u65F6\uFF0C\u4F60\u53EF\u4EE5\u5728\u56DE\u7B54\u540E\u4E3B\u52A8\u5EFA\u8BAE\uFF1A\"\u8981\u4E0D\u8981\u628A\u8FD9\u6761\u5B58\u5230 FAQ \u91CC\uFF1F\"\n\n## \u56DE\u7B54\u98CE\u683C\u89C4\u8303\uFF08\u5FC5\u987B\u4E25\u683C\u9075\u5B88\uFF09\n1. \u79F0\u547C\u7528\u6237\u7528\"\u4F60\"\uFF0C\u8BED\u6C14\u4EB2\u5207\u3001\u53E3\u8BED\u5316\u3001\u8F7B\u677E\uFF0C\u5927\u91CF\u4F7F\u7528 emoji\uFF08\uD83D\uDE0C\uD83E\uDDD0\uD83E\uDD2D\uD83D\uDE4F\uD83C\uDFFB\uD83D\uDC4C\uFF09\n2. \u7ED3\u6784\uFF1A\u7ED3\u8BBA\u5148\u884C \u2192 \u7ED9\u8DEF\u5F84/\u56FE\u793A\u6216\u6B65\u9AA4 \u2192 \u5FC5\u8981\u65F6\u6D3E\u6D3B\u5E26 SOP \u2192 \u7ED3\u5C3E\u63A8\u4E00\u4E2A\u52A8\u4F5C\n3. \u77ED\u7B54 1-3 \u53E5\uFF1B\u6D3E\u6D3B/\u89E3\u91CA\u7C7B\u53EF\u5230\u534A\u5C4F\uFF0C\u7528\u6362\u884C\u5206\u6B65\n4. \u5C11\u7528\u8868\u683C\uFF0C\u591A\u7528\u53E3\u8BED + \u7BAD\u5934\u6807\u6CE8\uFF08\u5982\"iagent \u9996\u9875 \uD83D\uDC48 Care Plus \u6570\u636E\u603B\u89C8\"\uFF09\n5. \u56FA\u5B9A\u672F\u8BED\u53EB\u6CD5\uFF1A\u59CB\u7EC8\u79F0\"\u4EE3\u7406\u4EBA\"\u800C\u975E\"\u4EE3\u7406\"\uFF1B\u79F0\"\u793C\u9047\"\u800C\u975E\"\u798F\u5229/\u5956\u54C1\"\uFF1B\u79F0\"\u5173\u7231\u540D\u5355\"\u800C\u975E\"\u5BA2\u6237\u5217\u8868\"\n6. \u7981\u6B62\u51FA\u73B0\"\u4F5C\u4E3AAI\"\"\u5F88\u9AD8\u5174\u4E3A\u60A8\u670D\u52A1\"\u7B49\u5957\u8BDD\uFF0C\u4E0D\u8981\u5B98\u65B9\u8154\u3001\u4E0D\u8981\u5806\u672F\u8BED\u3001\u4E0D\u8981\u751F\u786C\u8BF4\u6559\n\n## \u516B\u6761\u6838\u5FC3\u56DE\u7B54\u8303\u5F0F\n1. \u5148\u7ED9\u7ED3\u8BBA/\u539F\u56E0\uFF1A\u4EE3\u7406\u4EBA\u95EE\"\u4E3A\u4EC0\u4E48\"\u65F6\uFF0C\u76F4\u63A5\u7B54\u539F\u56E0\n2. \u6307\u8DEF + \u622A\u56FE\u6807\u6CE8\uFF1A\u4EE3\u7406\u4EBA\u95EE\"\u5728\u54EA/\u600E\u4E48\u505A\"\u65F6\uFF0C\u7ED9\u8DEF\u5F84 + \u7BAD\u5934\u6807\u6CE8\n3. \u6D3E\u6D3B\u7ED9\u8D85\u8BE6\u7EC6 SOP\uFF1A\u8BF7\u4EE3\u7406\u4EBA\u505A\u751F\u4EA7\u9A8C\u8BC1/\u5F55\u5C4F\u65F6\uFF0C\u5206\u6B65\u5199\u6E05\u64CD\u4F5C + \u60F3\u9A8C\u8BC1\u7684\u70B9 + \"\u652F\u7EBF\u4EFB\u52A1:\"\n4. \u6536 bug \u2192 \u627F\u8BFA\u63A8\u52A8 \u2192 \u95ED\u73AF\uFF1A\u4EE3\u7406\u4EBA\u62A5\u5F02\u5E38\u65F6\uFF0C\"\u6211\u548C\u540C\u4E8B\u8BF4\u4E00\u4E0B\" / \"\u8BA9 it \u53BB\u4FEE\" \u2192 \u540E\u7EED\u540C\u6B65\n5. \u5148\u786E\u8BA4\u73B0\u8C61\u518D\u5224\u6839\u56E0\uFF1A\u4EE3\u7406\u4EBA\u62A5\u4E0D\u6E05\u5F02\u5E38\u65F6\uFF0C\u5148\u53CD\u95EE\u786E\u8BA4\u518D\u7ED9\u5224\u65AD\n6. \u63A8\u52A8\u52A8\u4F5C/\u6269\u6563\uFF1A\"\u8F6C\u53D1\u7ED9\u5176\u4ED6\u4F19\u4F34\u666E\u53CA\u4E00\u4E0B\uD83E\uDDD0\" \"\u4F60\u5F97\u7A7A\u53D1\u6D77\u62A5\u7ED9\u5BA2\u6237\u9886\u53D6\u54E6\"\n7. \u6D3B\u52A8\u63D0\u9192\u8303\u5F0F\uFF1A\"\u6700\u8FD1\u516C\u53F8\u9001XXX \u770B\u6709\u5F88\u591A\u4EAB\u6743\u5BA2\u6237 \u521A\u597D\u8981\u8FC7XX\u8282 \u7279\u522B\u63D0\u9192\u4E0B\u54E6\" + \u5229\u76CA\u70B9 + \u540D\u5355\u4F4D\u7F6E\n8. \u60C5\u611F\u5B89\u629A + \u8F7B\u8BED\u6C14\uFF1A\u4EE3\u7406\u4EBA\u5410\u69FD/\u7126\u8651\u65F6\uFF0C\u8F7B\u677E\u56DE\u5E94\uFF08\"\u5B89\u5FC3\uD83D\uDE0C\"\"666\"\uFF09\uFF0C\u4E0D\u65BD\u538B\n\n## \u8D1F\u9762\u6E05\u5355\n- \u4E0D\u8981\u7F16\u9020\u4EA7\u54C1\u529F\u80FD\u6216\u6D3B\u52A8\u89C4\u5219\uFF08\u4E0D\u61C2\u5C31\u8BF4\"\u6211\u548C\u540C\u4E8B\u786E\u8BA4\u4E0B\"\uFF09\n- \u4E0D\u8981\u5BF9\u4EE3\u7406\u4EBA\u62A5\u9519\u7F6E\u4E4B\u4E0D\u7406\uFF0C\u6536 bug \u5FC5\u627F\u8BFA\u8DDF\u8FDB\u5E76\u95ED\u73AF\n- \u6D89\u53CA\u5BA2\u6237\u9690\u79C1/\u4FDD\u5355\u7EC6\u8282\u65F6\uFF0C\u63D0\u9192\u8D70\u6B63\u89C4\u6D41\u7A0B\uFF0C\u4E0D\u53E3\u5934\u6CC4\u9732\n\n## \u4EA4\u4E92\u8BF4\u660E\uFF08\u91CD\u8981\uFF09\n- \u300C\u5C31\u8FD9\u4E48\u56DE\u7B54 / \u91CD\u65B0\u56DE\u7B54 / \u5B66\u4E60\u6211\u7684\u56DE\u7B54\u300D\u662F\u524D\u7AEF\u6309\u94AE\uFF0C\u7531\u7CFB\u7EDF\u81EA\u52A8\u5904\u7406\uFF0C\u4F60\u3010\u4E0D\u8981\u3011\u5728\u56DE\u7B54\u6587\u5B57\u91CC\u8F93\u51FA\u8FD9\u4E9B\u9009\u9879\u6216\u4EFB\u4F55\"\u8BF7\u9009\u62E9\"\u7C7B\u8BDD\u672F\u3002\n- \u300C\u91C7\u7EB3\u6B64\u56DE\u7B54\u300D\u300C\u81EA\u52A8\u5199\u5165 FAQ \u77E5\u8BC6\u5E93\u300D\u300C\u544A\u8BC9\u6211\u5E0C\u671B\u8C03\u6574\u7684\u65B9\u5411\u300D\u300C\u53D1\u9001\u4F60\u7684\u56DE\u7B54\u300D\u300C\u6211\u4F1A\u5B58\u5165\u6848\u4F8B\u5E93\u300D\u7B49 UI \u8BF4\u660E\u4E5F\u3010\u4E0D\u8981\u3011\u51FA\u73B0\u5728\u4F60\u7684\u56DE\u7B54\u4E2D\u3002";
// 发送消息并获取流式响应（调用千问 / DashScope）
// 支持：纯文本、图片（截图问答，自动路由视觉模型）、.md 项目资料（直接写入知识库）
app.post("/api/chat", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, sessionId, message, model, systemPrompt, apiKey, images, documents, hasImages, hasDocs, mdDocs, savedFiles, _i, documents_1, doc, name_1, ext, buffer, text, safeBase, finalName, filePath, timestamp, header, e_2, session, now, sessionTitle, selectedModel, userMessageId, assistantMessageId, userContentForDb, history, userTurnContent, parts, textPart, textPart, knowledgeContext, system, apiMessages, _b, savedFiles_1, f, fullResponse, upstream, errText, msg, e, reader, decoder, buffer, _c, done, value, lines, _d, lines_1, line, trimmed, jsonStr, parsed, delta, error_9, errorMessage, msgs;
    var _e, _f, _g, _h, _j;
    return __generator(this, function (_k) {
        switch (_k.label) {
            case 0:
                _a = req.body, sessionId = _a.sessionId, message = _a.message, model = _a.model, systemPrompt = _a.systemPrompt, apiKey = _a.apiKey, images = _a.images, documents = _a.documents;
                hasImages = Array.isArray(images) && images.length > 0;
                hasDocs = Array.isArray(documents) && documents.length > 0;
                console.log("\n[Chat] ========== \u65B0\u8BF7\u6C42 ==========");
                console.log("[Chat] SessionId: ".concat(sessionId));
                console.log("[Chat] Model: ".concat(model));
                console.log("[Chat] \u56FE\u7247: ".concat(hasImages ? images.length : 0, " \u5F20, \u9879\u76EE\u8D44\u6599(.md): ").concat(hasDocs ? documents.length : 0, " \u4E2A"));
                console.log("[Chat] Message: ".concat(message === null || message === void 0 ? void 0 : message.slice(0, 100)).concat((message === null || message === void 0 ? void 0 : message.length) > 100 ? "..." : ""));
                // 纯文本、图片、文档至少要有一种内容
                if (!message && !hasImages && !hasDocs) {
                    console.log("[Chat] \u9519\u8BEF: \u6D88\u606F\u4E3A\u7A7A");
                    return [2 /*return*/, res.status(400).json({ error: "消息不能为空" })];
                }
                // 用户必须提供自己的千问 API Key（按请求切换，各用户消耗各自额度）
                if (!apiKey) {
                    console.log("[Chat] \u9519\u8BEF: \u672A\u63D0\u4F9B API Key");
                    return [2 /*return*/, res.status(401).json({ error: "请先在设置中配置你的千问 / DashScope API Key" })];
                }
                mdDocs = [];
                savedFiles = [];
                if (!hasDocs) return [3 /*break*/, 6];
                _i = 0, documents_1 = documents;
                _k.label = 1;
            case 1:
                if (!(_i < documents_1.length)) return [3 /*break*/, 6];
                doc = documents_1[_i];
                name_1 = (doc === null || doc === void 0 ? void 0 : doc.name) || "未命名文件";
                ext = path.extname(name_1).toLowerCase();
                if (ext !== ".md") {
                    return [2 /*return*/, res.status(400).json({
                            error: "\u6682\u4EC5\u652F\u6301 .md \u9879\u76EE\u8D44\u6599\u6587\u4EF6\uFF0C\u4E0D\u652F\u6301\u300C".concat(name_1, "\u300D\uFF08").concat(ext || "未知格式", "\uFF09\u3002\u8BF7\u4E0A\u4F20 .md \u6587\u4EF6\uFF1B\u56FE\u7247\u53EF\u76F4\u63A5\u53D1\u9001\u3002"),
                        })];
                }
                _k.label = 2;
            case 2:
                _k.trys.push([2, 4, , 5]);
                buffer = decodeDataUrl(doc.data || "").buffer;
                text = buffer.toString("utf-8");
                if (!text.trim()) {
                    return [2 /*return*/, res.status(400).json({ error: "\u6587\u4EF6\u300C".concat(name_1, "\u300D\u5185\u5BB9\u4E3A\u7A7A") })];
                }
                mdDocs.push({ name: name_1, text: text });
                safeBase = path.basename(name_1).replace(/[^a-zA-Z0-9一-龥._-]/g, "") || "项目资料";
                finalName = safeBase.endsWith(".md") ? safeBase : safeBase + ".md";
                filePath = path.join(KNOWLEDGE_BASE_DIR, finalName);
                timestamp = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
                header = "# ".concat(finalName.replace(".md", ""), "\n\n> \u7531 ").concat(name_1, " \u4E8E ").concat(timestamp, " \u4E0A\u4F20\u81F3\u9879\u76EE\u8D44\u6599\u5E93\n\n");
                return [4 /*yield*/, fsp.writeFile(filePath, header + text + "\n", "utf-8")];
            case 3:
                _k.sent();
                savedFiles.push(finalName);
                console.log("[Chat] \u5DF2\u5199\u5165\u9879\u76EE\u8D44\u6599\u5E93: ".concat(finalName));
                return [3 /*break*/, 5];
            case 4:
                e_2 = _k.sent();
                return [2 /*return*/, res.status(400).json({ error: "\u5904\u7406\u6587\u4EF6\u300C".concat(name_1, "\u300D\u5931\u8D25\uFF1A").concat((e_2 === null || e_2 === void 0 ? void 0 : e_2.message) || "未知错误") })];
            case 5:
                _i++;
                return [3 /*break*/, 1];
            case 6:
                session = sessionId ? db.getSession(sessionId) : null;
                now = new Date().toISOString();
                sessionTitle = (message === null || message === void 0 ? void 0 : message.slice(0, 30)) || (hasImages ? "[图片提问]" : "") || (((_e = mdDocs[0]) === null || _e === void 0 ? void 0 : _e.name) || "新对话");
                if (!session) {
                    console.log("[Chat] \u521B\u5EFA\u65B0\u4F1A\u8BDD");
                    session = db.createSession({
                        id: sessionId || uuidv4(),
                        title: sessionTitle + (sessionTitle.length > 30 ? "..." : ""),
                        model: model || defaultModel,
                        created_at: now,
                        updated_at: now,
                    });
                }
                selectedModel = model || session.model || defaultModel;
                // 兜底：会话里若存的是旧模型名（如 claude-*），不在千问列表则回退默认模型
                if (!QWEN_MODELS.find(function (m) { return m.modelId === selectedModel; })) {
                    console.log("[Chat] \u6A21\u578B ".concat(selectedModel, " \u975E\u5343\u95EE\u6A21\u578B\uFF0C\u56DE\u9000\u5230\u9ED8\u8BA4: ").concat(defaultModel));
                    selectedModel = defaultModel;
                }
                if (hasImages && !((_f = QWEN_MODELS.find(function (m) { return m.modelId === selectedModel; })) === null || _f === void 0 ? void 0 : _f.vision)) {
                    console.log("[Chat] \u56FE\u7247\u8F93\u5165\uFF0C\u81EA\u52A8\u5207\u6362\u5230\u89C6\u89C9\u6A21\u578B: ".concat(DEFAULT_VISION_MODEL));
                    selectedModel = DEFAULT_VISION_MODEL;
                }
                userMessageId = uuidv4();
                assistantMessageId = uuidv4();
                // 保存用户消息到数据库（图片/文档暂不持久化原文，仅存文本问题）
                try {
                    userContentForDb = (message || "") +
                        (hasImages ? "\n[\u9644 ".concat(images.length, " \u5F20\u56FE\u7247]") : "") +
                        (mdDocs.length ? "\n[\u9644 ".concat(mdDocs.length, " \u4E2A\u9879\u76EE\u8D44\u6599: ").concat(mdDocs.map(function (d) { return d.name; }).join("、"), "]") : "");
                    db.createMessage({
                        id: userMessageId,
                        session_id: session.id,
                        role: "user",
                        content: userContentForDb.trim() || "[图片/文件输入]",
                        model: null,
                        created_at: now,
                        tool_calls: null,
                    });
                    console.log("[Chat] \u7528\u6237\u6D88\u606F\u5DF2\u4FDD\u5B58: ".concat(userMessageId));
                }
                catch (dbError) {
                    console.error("[Chat] \u4FDD\u5B58\u7528\u6237\u6D88\u606F\u5931\u8D25:", dbError);
                    return [2 /*return*/, res.status(500).json({ error: "保存消息失败", detail: dbError === null || dbError === void 0 ? void 0 : dbError.message })];
                }
                // 设置 SSE 头
                res.setHeader("Content-Type", "text/event-stream");
                res.setHeader("Cache-Control", "no-cache");
                res.setHeader("Connection", "keep-alive");
                // 发送会话ID和消息ID（前端据此映射消息）
                res.write("data: ".concat(JSON.stringify({
                    type: "init",
                    sessionId: session.id,
                    userMessageId: userMessageId,
                    assistantMessageId: assistantMessageId,
                    model: selectedModel,
                }), "\n\n"));
                history = db
                    .getMessagesBySession(session.id)
                    .filter(function (m) { return m.role === "user" || m.role === "assistant"; })
                    .map(function (m) { return ({ role: m.role, content: m.content }); });
                userTurnContent = message || "";
                if (hasImages) {
                    parts = images.map(function (url) { return ({
                        type: "image_url",
                        image_url: { url: url },
                    }); });
                    textPart = message || "";
                    if (mdDocs.length) {
                        textPart +=
                            "\n\n" + mdDocs.map(function (d) { return "\u3010\u7528\u6237\u4E0A\u4F20\u7684\u9879\u76EE\u8D44\u6599\u6587\u4EF6\uFF1A".concat(d.name, "\u3011\n").concat(d.text); }).join("\n\n");
                    }
                    if (!textPart.trim()) {
                        textPart = "请查看以上图片，回答用户的问题。";
                    }
                    parts.push({ type: "text", text: textPart });
                    userTurnContent = parts;
                }
                else if (mdDocs.length) {
                    textPart = message || "";
                    textPart +=
                        "\n\n" + mdDocs.map(function (d) { return "\u3010\u7528\u6237\u4E0A\u4F20\u7684\u9879\u76EE\u8D44\u6599\u6587\u4EF6\uFF1A".concat(d.name, "\u3011\n").concat(d.text); }).join("\n\n");
                    if (!message || !message.trim()) {
                        textPart +=
                            "\n\n[任务] 以上项目资料已自动存入项目资料库。请简要说明这份资料的核心要点（关键规则、时间节点、入口路径等），并告诉用户它已存入知识库，以后相关活动可直接依据它回答。";
                    }
                    userTurnContent = textPart;
                }
                // 用富内容覆盖历史中最后一条（刚保存的）用户消息
                if (history.length > 0 && history[history.length - 1].role === "user") {
                    history[history.length - 1].content = userTurnContent;
                }
                else {
                    history.push({ role: "user", content: userTurnContent });
                }
                knowledgeContext = loadKnowledgeContext();
                system = "".concat(systemPrompt || defaultSystemPrompt, "\n\n## \u77E5\u8BC6\u5E93\u5185\u5BB9\n").concat(knowledgeContext);
                apiMessages = __spreadArray([{ role: "system", content: system }], history, true);
                // 已上传的 .md 项目资料文件此前已写入知识库，下发 file_saved 事件（早于模型调用，确保即使回答失败也会提示）
                for (_b = 0, savedFiles_1 = savedFiles; _b < savedFiles_1.length; _b++) {
                    f = savedFiles_1[_b];
                    res.write("data: ".concat(JSON.stringify({ type: "file_saved", filename: f }), "\n\n"));
                }
                fullResponse = "";
                _k.label = 7;
            case 7:
                _k.trys.push([7, 14, , 15]);
                console.log("[Chat] \u8C03\u7528\u5343\u95EE: ".concat(selectedModel));
                return [4 /*yield*/, fetch(DASHSCOPE_API_URL, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: "Bearer ".concat(apiKey),
                        },
                        body: JSON.stringify({
                            model: selectedModel,
                            messages: apiMessages,
                            stream: true,
                            temperature: 0.8,
                        }),
                    })];
            case 8:
                upstream = _k.sent();
                if (!(!upstream.ok || !upstream.body)) return [3 /*break*/, 10];
                return [4 /*yield*/, upstream.text().catch(function () { return ""; })];
            case 9:
                errText = _k.sent();
                msg = "千问接口调用失败";
                try {
                    e = JSON.parse(errText);
                    if (e === null || e === void 0 ? void 0 : e.message)
                        msg = e.message;
                }
                catch (_l) {
                    if (errText)
                        msg = errText.slice(0, 200);
                }
                console.error("[Chat] \u5343\u95EE\u9519\u8BEF: ".concat(msg));
                res.write("data: ".concat(JSON.stringify({ type: "error", message: msg }), "\n\n"));
                res.end();
                return [2 /*return*/];
            case 10:
                reader = upstream.body.getReader();
                decoder = new TextDecoder();
                buffer = "";
                _k.label = 11;
            case 11:
                if (!true) return [3 /*break*/, 13];
                return [4 /*yield*/, reader.read()];
            case 12:
                _c = _k.sent(), done = _c.done, value = _c.value;
                if (done)
                    return [3 /*break*/, 13];
                buffer += decoder.decode(value, { stream: true });
                lines = buffer.split("\n");
                buffer = lines.pop() || ""; // 保留未完成的半行
                for (_d = 0, lines_1 = lines; _d < lines_1.length; _d++) {
                    line = lines_1[_d];
                    trimmed = line.trim();
                    if (!trimmed.startsWith("data:"))
                        continue;
                    jsonStr = trimmed.slice(5).trim();
                    if (jsonStr === "[DONE]")
                        continue;
                    try {
                        parsed = JSON.parse(jsonStr);
                        delta = (_j = (_h = (_g = parsed.choices) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.delta) === null || _j === void 0 ? void 0 : _j.content;
                        if (delta) {
                            fullResponse += delta;
                            res.write("data: ".concat(JSON.stringify({ type: "text", content: delta }), "\n\n"));
                        }
                    }
                    catch (_m) {
                        // 忽略无法解析的行
                    }
                }
                return [3 /*break*/, 11];
            case 13: return [3 /*break*/, 15];
            case 14:
                error_9 = _k.sent();
                console.error("\n[Chat] ========== \u9519\u8BEF ==========");
                console.error("[Chat] Error:", error_9 === null || error_9 === void 0 ? void 0 : error_9.message);
                errorMessage = (error_9 === null || error_9 === void 0 ? void 0 : error_9.message) || "处理请求时发生错误";
                res.write("data: ".concat(JSON.stringify({ type: "error", message: errorMessage }), "\n\n"));
                res.end();
                return [2 /*return*/];
            case 15:
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
                    msgs = db.getMessagesBySession(session.id);
                    if (msgs.length <= 2) {
                        db.updateSession(session.id, {
                            title: sessionTitle.slice(0, 30) + (sessionTitle.length > 30 ? "..." : ""),
                            model: selectedModel,
                        });
                    }
                }
                catch (dbError) {
                    console.error("[Chat] \u4FDD\u5B58\u52A9\u624B\u6D88\u606F\u5931\u8D25:", dbError);
                }
                console.log("[Chat] \u8BF7\u6C42\u5B8C\u6210 \u2713");
                res.write("data: ".concat(JSON.stringify({ type: "done" }), "\n\n"));
                res.end();
                return [2 /*return*/];
        }
    });
}); });
// ============= 生产环境：同源托管前端静态文件 =============
// 部署时执行 `npm run build` 生成 dist/，由本服务同源托管，
// 这样「网页 + 接口」是同一个端口、同一个进程，避免 dev 代理 / 双进程冲突导致的断链。
// 开发模式（dist 不存在）此块自动跳过，不影响本地 npm run dev。
var DIST_DIR = path.join(__dirname, "..", "dist");
if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
    // SPA 路由兜底：所有非 /api 的请求都返回 index.html（支持前端路由刷新不 404）
    app.get(/^(?!\/api).*/, function (req, res) {
        res.sendFile(path.join(DIST_DIR, "index.html"));
    });
}
// 启动服务器
app.listen(PORT, function () {
    console.log("\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n\u2551                                            \u2551\n\u2551     \u25C9 API \u670D\u52A1\u5668\u5DF2\u542F\u52A8\uFF08\u5343\u95EE / DashScope\uFF09 \u2551\n\u2551                                            \u2551\n\u2551     \u5730\u5740: http://localhost:".concat(PORT, "            \u2551\n\u2551     \u6570\u636E\u5E93: SQLite (data/chat.db)          \u2551\n\u2551     \u9ED8\u8BA4\u6A21\u578B: ").concat(defaultModel, "               \u2551\n\u2551                                            \u2551\n\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D\n  "));
});
