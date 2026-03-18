# Localingo

[English](README.md) | [한국어](README_KO.md) | [中文](README_ZH.md)

Ollama 기반 로컬 번역 + 요약 도구. 인터넷 없이, 비용 없이, 프라이버시를 유지하며 다국어 작업.

## Prerequisites

- Python 3.12+
- Node.js 18+
- **Ollama** (로컬 LLM 런타임)

## Ollama Setup

```bash
# 1. Ollama 설치 (아직 안 했다면)
brew install ollama

# 2. 필수 모델 다운로드
ollama pull translategemma:latest    # 번역용 (3.3GB)
ollama pull qwen3.5:latest           # 요약용 (6.6GB)

# 3. Ollama 서버 실행 확인
ollama list
```

### 사용 모델

| 모델 | 크기 | 용도 | 자동 선택 |
|------|------|------|----------|
| `translategemma:latest` | 3.3GB | 텍스트 번역 | 번역 요청 시 자동 |
| `qwen3.5:latest` | 6.6GB | 요약 | 요약 요청 시 자동 |

- 번역 시 → `translategemma:latest` 자동 사용
- 요약 시 → `qwen3.5:latest` 자동 사용
- 설정에서 모델 오버라이드 가능 (고급)

### 지원 언어

Korean, English, Chinese, Japanese, Spanish, French, German

## Quick Start

```bash
./setup.sh      # 원커맨드 설치
./run.sh start   # 서버 시작
```

- Frontend: http://localhost:3050
- Backend: http://localhost:8050

## Ports

| Service | Port |
|---------|------|
| Backend (FastAPI) | 8050 |
| Frontend (Next.js) | 3050 |
| Ollama | 11434 (기본) |
