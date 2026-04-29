# AutoIntel
Curated used car marketplace for niche buyers, starting with cold-weather commuter cars.

## Run With Docker Compose

```bash
docker compose -f infra/compose.yaml up --build
```

- Web UI: `http://localhost:3001`
- API: `http://localhost:8000`
- OpenSearch: `http://localhost:9200`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

## Retrain Pricing Model

Run this from the API environment after Postgres is running. It appends eligible `carlisting` rows to `app_ready.csv`, reruns the notebook, and replaces `car_price_pipeline.pkl` only after the notebook succeeds.

```bash
cd apps/api
python -m app.tasks.retrain_pricing_model
```

## VIN Photo OCR

VIN photo scanning runs locally with Tesseract OCR, then validates the 17-character VIN checksum before decoding vehicle details. Docker installs Tesseract automatically. For local API development, install the system binary first:

```bash
brew install tesseract
```

Cloud OCR can be enabled with AWS Rekognition:

```bash
VIN_OCR_PROVIDER=aws_rekognition
VIN_OCR_AWS_REGION=us-east-1
VIN_OCR_AWS_ACCESS_KEY_ID=...
VIN_OCR_AWS_SECRET_ACCESS_KEY=...
```

Use `VIN_OCR_PROVIDER=auto` to try AWS Rekognition when VIN OCR AWS credentials, `AWS_ACCESS_KEY_ID`, or an AWS profile are present and fall back to Tesseract otherwise.

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
