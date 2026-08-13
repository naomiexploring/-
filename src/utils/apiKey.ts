const STORAGE_KEY = 'qwen_api_key';

/**
 * 获取当前用户存储在浏览器中的 API Key
 */
export function getApiKey(): string {
  return localStorage.getItem(STORAGE_KEY) || '';
}

/**
 * 保存 API Key 到浏览器 localStorage
 */
export function setApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key);
}

/**
 * 清除已保存的 API Key
 */
export function clearApiKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 检查是否已设置 API Key
 */
export function hasApiKey(): boolean {
  return !!getApiKey();
}

/**
 * 获取 API Key 的脱敏显示（只显示前4位和后4位）
 */
export function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}
