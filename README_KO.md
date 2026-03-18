# Localingo

[English](README.md) | [한국어](README_KO.md) | [中文](README_ZH.md)

Ollama 기반 로컬 번역 + 요약 도구. 인터넷 없이, 비용 없이, 프라이버시를 유지하며 다국어 작업.

## 사전 준비

- Python 3.12+
- Node.js 18+
- **Ollama** (로컬 LLM 런타임)

## Ollama 설정

```bash
# 1. Ollama 설치
brew install ollama

# 2. 필수 모델 다운로드
ollama pull translategemma:latest    # 번역용 (3.3GB)
ollama pull qwen3.5:latest           # 요약용 (6.6GB)

# 3. 확인
ollama list
```

### 사용 모델

| 모델 | 크기 | 용도 |
|------|------|------|
| translategemma:latest | 3.3GB | 번역 (자동 선택) |
| qwen3.5:latest | 6.6GB | 요약 (자동 선택) |

설정에서 모든 Ollama 모델로 오버라이드 가능.

## 빠른 시작

```bash
./setup.sh      # 원커맨드 설치
./run.sh start   # 서버 시작
```

- 프론트엔드: http://localhost:3050
- 백엔드: http://localhost:8050

## 주요 기능

- **빠른 번역**: 인스턴트 번역 바 (자동 언어 감지, 59개 언어)
- **번역 세션**: 채팅형 번역, 생성/삭제/수정/내보내기(MD)
- **요약**: 번역 결과 요약 (별도 모델)
- **실시간 진행바**: 토큰 스트리밍 SSE
- **청킹**: 설정 가능 (XSmall 100자 ~ XLarge 5,000자)
- **스마트 모델 관리**: GPU 메모리 자동 최적화
- **LLM 설정**: 다중 프로바이더 (Ollama/DeepL/Google/OpenAI)
- **UI 언어**: 한국어/English/中文
- **다크 모드**

## 포트

| 서비스 | 포트 |
|--------|------|
| 백엔드 (FastAPI) | 8050 |
| 프론트엔드 (Next.js) | 3050 |
| Ollama | 11434 |
