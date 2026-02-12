# TraceTag Platform - 배포 매뉴얼

## 목차
1. [사전 준비](#1-사전-준비)
2. [설치 방법](#2-설치-방법)
3. [환경 설정](#3-환경-설정)
4. [실행](#4-실행)
5. [운영 명령어](#5-운영-명령어)
6. [폐쇄망 배포](#6-폐쇄망-배포-오프라인)
7. [데이터 관리](#7-데이터-관리)
8. [문제 해결](#8-문제-해결)

---

## 1. 사전 준비

### Docker 설치

**Windows:**
1. [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/) 다운로드 및 설치
2. WSL2 백엔드 활성화 (설치 중 안내에 따름)
3. 재부팅 후 Docker Desktop 실행
4. PowerShell에서 확인: `docker --version`

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 로그아웃 후 다시 로그인
docker --version
```

**Linux (CentOS/RHEL):**
```bash
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

**macOS:**
```bash
brew install --cask docker
# Docker Desktop 앱 실행
```

---

## 2. 설치 방법

### 방법 A: Git Clone (인터넷 가능 환경)
```bash
git clone https://github.com/hk0916/newTrace.git
cd newTrace
```

### 방법 B: 소스 압축 파일 (폐쇄망)
```bash
# 개발 PC에서 소스 압축
tar -czf tracetag-platform.tar.gz \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  --exclude=data \
  tracetag-platform/

# 서버로 파일 전송 후 압축 해제
tar -xzf tracetag-platform.tar.gz
cd tracetag-platform
```

> 폐쇄망 환경에서는 Docker 이미지를 미리 빌드해서 가져가야 합니다. [6. 폐쇄망 배포](#6-폐쇄망-배포-오프라인) 참고.

---

## 3. 환경 설정

`.env.docker` 파일을 서버 환경에 맞게 수정합니다.

```bash
# .env.docker 파일 편집
vi .env.docker   # Linux
notepad .env.docker   # Windows
```

### 설정 항목

| 변수 | 설명 | 기본값 | 예시 |
|------|------|--------|------|
| `SERVER_HOST` | 서버 IP 또는 도메인 | `localhost` | `192.168.1.100` |
| `WEB_PORT` | 웹 대시보드 포트 | `3000` | `80` |
| `WS_PORT` | WebSocket 포트 (게이트웨이) | `8080` | `8080` |
| `DB_PORT` | PostgreSQL 외부 포트 | `5432` | `15432` |
| `POSTGRES_USER` | DB 사용자명 | `tracetag_user` | `tracetag_user` |
| `POSTGRES_PASSWORD` | DB 비밀번호 | `tracetag_pass` | `강력한비밀번호` |
| `POSTGRES_DB` | DB 이름 | `tracetag_dev` | `tracetag_prod` |
| `NEXTAUTH_SECRET` | 인증 시크릿 키 | (기본값) | `openssl rand -base64 32` |

### 설정 예시

**사내 서버 (고정 IP):**
```env
SERVER_HOST=192.168.1.100
WEB_PORT=80
WS_PORT=8080
DB_PORT=5432
POSTGRES_PASSWORD=MySecurePass123!
NEXTAUTH_SECRET=생성한시크릿키
```

**클라우드 서버 (도메인):**
```env
SERVER_HOST=tracetag.example.com
WEB_PORT=3000
WS_PORT=8080
POSTGRES_PASSWORD=MySecurePass123!
NEXTAUTH_SECRET=생성한시크릿키
```

---

## 4. 실행

```bash
# 빌드 및 실행 (최초 1회 또는 코드 변경 시)
docker compose --env-file .env.docker up -d --build

# 이후 실행 (이미 빌드된 경우)
docker compose --env-file .env.docker up -d
```

### 확인

```bash
# 컨테이너 상태 확인
docker compose ps

# 로그 확인
docker compose logs -f

# 개별 서비스 로그
docker compose logs -f nextjs
docker compose logs -f wsserver
docker compose logs -f postgres
```

정상 실행 시:
- 웹 대시보드: `http://{SERVER_HOST}:{WEB_PORT}`
- WebSocket: `ws://{SERVER_HOST}:{WS_PORT}`
- 기본 관리자 계정: `admin@skaichips.com` / `admin123` (반드시 변경!)

---

## 5. 운영 명령어

```bash
# 중지
docker compose down

# 재시작
docker compose --env-file .env.docker restart

# 특정 서비스만 재시작
docker compose --env-file .env.docker restart nextjs

# 로그 실시간 확인
docker compose logs -f

# 이미지 재빌드 (코드 수정 후)
docker compose --env-file .env.docker up -d --build
```

---

## 6. 폐쇄망 배포 (오프라인)

인터넷이 없는 서버에 배포할 때는 Docker 이미지를 미리 빌드하여 파일로 전달합니다.

### 개발 PC에서 (인터넷 가능 환경)

```bash
# 1. 이미지 빌드
docker compose --env-file .env.docker build

# 2. 필요한 이미지 목록 확인
docker compose images

# 3. 이미지를 tar 파일로 저장
docker save -o tracetag-images.tar \
  tracetag-platform-nextjs:latest \
  tracetag-platform-wsserver:latest \
  postgres:16-alpine

# 4. 소스 + 이미지 파일을 서버로 전송
#    필요한 파일: tracetag-images.tar, docker-compose.yml, .env.docker, DEPLOY.md
```

### 배포 서버에서 (폐쇄망)

```bash
# 1. 이미지 로드
docker load -i tracetag-images.tar

# 2. 환경 설정
vi .env.docker

# 3. 실행 (--build 없이)
docker compose --env-file .env.docker up -d
```

### 폐쇄망 최소 전달 파일

```
tracetag-images.tar    # Docker 이미지 (약 1~2GB)
docker-compose.yml     # 서비스 구성
.env.docker            # 환경 설정
DEPLOY.md              # 이 매뉴얼
```

---

## 7. 데이터 관리

### DB 데이터 위치

PostgreSQL 데이터는 프로젝트 폴더 아래 `data/postgres/`에 저장됩니다.

```
tracetag-platform/
├── data/
│   └── postgres/    ← DB 데이터 (Docker 종료 후에도 유지)
├── docker-compose.yml
├── .env.docker
└── ...
```

- Docker를 중지(`docker compose down`)해도 데이터가 유지됩니다.
- 데이터를 완전히 초기화하려면: `rm -rf data/postgres`

### DB 백업

```bash
# 백업
docker compose exec postgres pg_dump -U tracetag_user tracetag_dev > backup.sql

# 복원
docker compose exec -T postgres psql -U tracetag_user tracetag_dev < backup.sql
```

### DB 접속 (직접)

```bash
docker compose exec postgres psql -U tracetag_user -d tracetag_dev
```

---

## 8. 문제 해결

### 포트 충돌
```
Error: bind: address already in use
```
→ `.env.docker`에서 해당 포트를 변경하세요.

### DB 연결 실패
```bash
# PostgreSQL 컨테이너 상태 확인
docker compose ps postgres
docker compose logs postgres
```

### 컨테이너가 시작되지 않을 때
```bash
# 전체 로그 확인
docker compose logs

# 컨테이너 재생성
docker compose down
docker compose --env-file .env.docker up -d --build
```

### 데이터 완전 초기화
```bash
docker compose down
rm -rf data/postgres
docker compose --env-file .env.docker up -d
```

### Windows에서 권한 오류
```
Permission denied: ./docker-entrypoint.sh
```
→ Git 설정 확인:
```bash
git config core.autocrlf false
git checkout -- docker-entrypoint.sh
```
