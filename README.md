# AutoIntel
Used Car Marketplace for the United States

## Run With Docker Compose

```bash
docker compose -f infra/compose.yaml up --build
```

- Web UI: `http://localhost:3001`
- API: `http://localhost:8000`
- OpenSearch: `http://localhost:9200`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

```
autointel/
  apps/
    api/
      app/
        api/v1/routes/
          auth.py
          cars.py
          admin.py
          media.py
        core/
          config.py
          security.py
          deps.py
        db/
          session.py
        models/
          user.py
          car.py
        schemas/
          auth.py
          car.py
          media.py
        services/
          opensearch.py
          s3.py
        tasks/
          worker.py
          indexer.py
        main.py
      alembic.ini
      pyproject.toml
      Dockerfile
      alembic/
        env.py
        script.py.mako
        versions/
  infra/
    compose.yaml
  .env.example
  README.md

```
