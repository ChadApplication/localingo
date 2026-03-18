# Localingo

[English](README.md) | [한국어](README_KO.md) | [中文](README_ZH.md)

基于 Ollama 的本地翻译 + 摘要工具。无需网络、零成本、保护隐私。

## 前提条件

- Python 3.12+
- Node.js 18+
- **Ollama** (本地 LLM 运行时)

## Ollama 设置

```bash
brew install ollama
ollama pull translategemma:latest    # 翻译 (3.3GB)
ollama pull qwen3.5:latest           # 摘要 (6.6GB)
```

## 快速开始

```bash
./setup.sh
./run.sh start
```

- 前端: http://localhost:3050
- 后端: http://localhost:8050

## 主要功能

- 即时翻译（自动检测语言，59种语言）
- 翻译会话（聊天式，创建/删除/编辑/导出MD）
- 摘要功能（独立模型）
- 实时进度条（Token流式SSE）
- 分块设置（100~5,000字）
- 智能模型管理（GPU内存自动优化）
- LLM设置（Ollama/DeepL/Google/OpenAI）
- UI语言（韩/英/中）
- 暗黑模式
