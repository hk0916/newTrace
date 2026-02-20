# TraceTag API Swagger 문서

## 파일 구조

```
swagger/
├── openapi.yaml   # OpenAPI 3.0 스펙 전체
├── index.html     # Swagger UI 뷰어
└── README.md      # 이 파일
```

## 보는 방법

### 방법 1) 로컬 HTTP 서버 실행

```bash
# npx serve 사용 (권장)
npx serve swagger/

# 또는 Python
cd swagger && python3 -m http.server 8888
```

브라우저에서 `http://localhost:3000` (또는 `8888`) 접속

### 방법 2) Next.js 실행 중일 때

`swagger/` 폴더를 `public/swagger/` 로 복사하면
`http://localhost:3000/swagger/index.html` 에서 바로 접근 가능

### 방법 3) Swagger Editor 온라인 사용

1. [editor.swagger.io](https://editor.swagger.io) 접속
2. `openapi.yaml` 내용 붙여넣기

## 엔드포인트 목록

| 태그 | 엔드포인트 |
|------|-----------|
| Gateways | `GET/POST /gateways`, `GET/PUT/DELETE /gateways/{gwMac}` |
| Tags | `GET/POST /tags`, `GET/PUT/DELETE /tags/{tagMac}`, `GET /tags/{tagMac}/sensing` |
| Companies | `GET/POST /companies`, `GET/PUT /company-settings` |
| Dashboard | `GET /dashboard/stats` |
| Alerts | `GET /alerts`, `POST /alerts/acknowledge`, `GET /alerts/history`, `GET/PUT /alert-settings` |
| Asset Maps | `GET/POST /asset-maps`, `GET/PUT/DELETE /asset-maps/{mapId}`, `PUT /asset-maps/{mapId}/placements`, `DELETE /asset-maps/{mapId}/placements/{placementId}`, `POST /asset-maps/{mapId}/set-dashboard` |
| Register | `GET /register/template`, `POST /register/bulk` |
| Gateway Control | `POST /gateway-control/command` |
| User | `PUT /user/locale`, `PUT /user/password` |
