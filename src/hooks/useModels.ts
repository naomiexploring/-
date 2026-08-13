import { useState, useEffect, useCallback } from 'react';
import { Model } from '../types';
import { getApiKey } from '../utils/apiKey';

const STORAGE_KEY = 'defaultModel';

export function useModels() {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || '';
  });

  const fetchModels = useCallback(async () => {
    try {
      const apiKey = getApiKey();
      if (!apiKey) return; // 未配置 API Key 时不请求
      const res = await fetch('/api/models', {
        headers: { 'X-Api-Key': apiKey },
      });
      const data = await res.json();
      setModels(data.models || []);
      if (data.models?.length > 0 && !selectedModel) {
        const savedDefault = localStorage.getItem(STORAGE_KEY);
        const modelToUse = savedDefault && data.models.some((m: Model) => m.modelId === savedDefault)
          ? savedDefault
          : (data.defaultModel || data.models[0].modelId);
        setSelectedModel(modelToUse);
        localStorage.setItem(STORAGE_KEY, modelToUse);
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  }, [selectedModel]);

  // 初始加载
  useEffect(() => {
    fetchModels();
  }, []);

  return {
    models,
    selectedModel,
    setSelectedModel,
    fetchModels,
  };
}
