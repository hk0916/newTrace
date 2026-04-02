# TraceTag Platform

BLE 자산 추적 플랫폼 — Next.js 대시보드 + WebSocket 게이트웨이 서버

## 구성

| 서비스 | 포트 | 설명 |
|--------|------|------|
| **nextjs** | 3000 | 웹 대시보드 + REST API |
| **wsserver** | 8080 | BLE 게이트웨이 WebSocket 서버 |
| **postgres** | 5432 | PostgreSQL 16 데이터베이스 |

## 빠른 시작

```bash
git clone https://github.com/hk0916/newTrace.git
cd newTrace
```

### 환경 설정

`.env.docker` 파일을 서버 환경에 맞게 수정합니다.

```bash
vi .env.docker
```

### Docker 실행

> **중요:** 반드시 `--env-file .env.docker` 옵션을 사용해야 합니다.
> docker-compose는 기본적으로 `.env` 파일만 읽기 때문에, 이 옵션 없이 실행하면 `.env.docker`의 설정(DB 비밀번호, DB명 등)이 적용되지 않고 기본값이 사용되어 DB 인증 오류가 발생합니다.

```bash
# 빌드 및 실행 (최초 또는 코드 변경 시)
docker compose --env-file .env.docker up -d --build

# 이후 실행
docker compose --env-file .env.docker up -d
```

### 상태 확인

```bash
docker compose ps
docker compose logs -f nextjs
```

## 운영 명령어

```bash
# 중지
docker compose down

# 재시작
docker compose --env-file .env.docker restart

# 특정 서비스만 재시작
docker compose --env-file .env.docker restart nextjs

# 코드 업데이트 후 재배포
git pull origin main
docker compose --env-file .env.docker up -d --build
```

## 개발 환경

```bash
npm install
npm run dev         # Next.js 개발 서버 (localhost:3000)
npm run ws:dev      # WebSocket 서버 (localhost:8080)
```

두 서버 모두 실행해야 전체 기능이 동작합니다.

## 문서

배포, 폐쇄망 설치, 데이터 관리, 문제 해결 등 상세 내용은 [DEPLOY.md](./DEPLOY.md)를 참고하세요.
