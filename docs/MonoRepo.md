# MonoRepo.md — Full Monorepo Structure

## Root Structure
```
/kanban-platform
  /backend
  /frontend
  /gateway
  /docker
  /docs
  docker-compose.yml
  README.md
```

## Backend (FastAPI)
```
/backend
  /app
    /api
    /models
    /schemas
    /services
    /core
  main.py
  requirements.txt
```

Services:
- auth
- tasks
- projects
- docs
- time
- import_export
- sap_adapter

## Frontend (React)
```
/frontend
  /src
    /pages
    /features
      /kanban
      /gantt
      /docs
      /whiteboard
      /calendar
      /time
    /components
    /store
    /api
  package.json
```

## Gateway
```
/gateway
  nginx.conf
```

## Docker
```
/docker
  backend.Dockerfile
  frontend.Dockerfile
  nginx.Dockerfile
```

## docker-compose.yml
- backend
- frontend
- postgres
- mongo
- redis
- nginx

## CI/CD (GitHub Actions)
```
.github/workflows
  ci.yml
```

Pipeline:
- install deps
- lint
- test
- build docker images

## Dev Flow
1. docker-compose up
2. backend → localhost:8000
3. frontend → localhost:3000
4. nginx → localhost

## Extensions
- Kubernetes ready
- Horizontal scaling
- Async workers (Celery)

---
