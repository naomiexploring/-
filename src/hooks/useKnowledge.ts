import { useState, useCallback, useEffect } from 'react';

export interface KnowledgeFile {
  filename: string;
  size: number;
  lineCount: number;
  wordCount: number;
  preview: string;
  updatedAt: string;
}

export interface KnowledgeStats {
  totalFiles: number;
  totalSize: number;
  totalLines: number;
  totalWords: number;
  files: KnowledgeFile[];
}

export function useKnowledge() {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentFile, setCurrentFile] = useState<{ filename: string; content: string } | null>(null);

  // 获取知识库文件列表
  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge');
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
      }
    } catch (err) {
      console.error('Failed to fetch knowledge files:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取统计信息
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/knowledge/stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  // 读取文件内容
  const fetchFileContent = useCallback(async (filename: string) => {
    try {
      const res = await fetch(`/api/knowledge/${encodeURIComponent(filename)}`);
      const data = await res.json();
      if (data.content !== undefined) {
        setCurrentFile({ filename, content: data.content });
      }
      return data;
    } catch (err) {
      console.error('Failed to fetch file content:', err);
      return null;
    }
  }, []);

  // 新增/追加内容
  const addContent = useCallback(async (filename: string, content: string, mode: 'append' | 'overwrite' = 'append') => {
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content, mode }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchFiles();
        await fetchStats();
      }
      return data;
    } catch (err) {
      console.error('Failed to add content:', err);
      return { success: false, error: '添加失败' };
    }
  }, [fetchFiles, fetchStats]);

  // 创建新文件
  const createFile = useCallback(async (filename: string, content: string, description?: string) => {
    try {
      const res = await fetch('/api/knowledge/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content, description }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchFiles();
        await fetchStats();
      }
      return data;
    } catch (err) {
      console.error('Failed to create file:', err);
      return { success: false, error: '创建失败' };
    }
  }, [fetchFiles, fetchStats]);

  // 删除文件
  const deleteFile = useCallback(async (filename: string) => {
    try {
      const res = await fetch(`/api/knowledge/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        await fetchFiles();
        await fetchStats();
      }
      return data;
    } catch (err) {
      console.error('Failed to delete file:', err);
      return { success: false, error: '删除失败' };
    }
  }, [fetchFiles, fetchStats]);

  // 学习问答对
  const learnQA = useCallback(async (params: {
    type: 'accept_answer' | 'learn_answer' | 'add_material';
    question: string;
    answer?: string;
    userAnswer?: string;
    category?: string;
  }) => {
    try {
      const res = await fetch('/api/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (data.success) {
        await fetchFiles();
        await fetchStats();
      }
      return data;
    } catch (err) {
      console.error('Failed to learn:', err);
      return { success: false, error: '学习失败' };
    }
  }, [fetchFiles, fetchStats]);

  useEffect(() => {
    fetchFiles();
    fetchStats();
  }, [fetchFiles, fetchStats]);

  return {
    files,
    stats,
    loading,
    currentFile,
    setCurrentFile,
    fetchFiles,
    fetchStats,
    fetchFileContent,
    addContent,
    createFile,
    deleteFile,
    learnQA,
  };
}
