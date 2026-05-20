# NicheRides
Curated used car marketplace for niche buyers, starting with cold-weather commuter cars.

## Run With Docker Compose

```bash
docker compose -f infra/docker-compose.yaml up --build
```

- Web UI: `http://localhost:3001`
- API: `http://localhost:8000`
- MinIO API: `http://localhost:9000`
- MinIO Console: `http://localhost:9001`

## Price Prediction

Price prediction is served by the separate `nicherides-ml-platform` service. Point the API at its prediction endpoint:

```bash
PRICE_PREDICTION_API_URL=http://localhost:8001/v1/price/predict
```

Docker Compose points the API container at the host gateway by default:

```bash
PRICE_PREDICTION_API_URL=http://host.docker.internal:8080/v1/price/predict
```

## VIN Photo OCR

VIN photo scanning calls the separate `nicherides-ml-platform` service by default, then validates the 17-character VIN checksum before decoding vehicle details:

```bash
VIN_SCAN_API_URL=http://localhost:8001/v1/vin/photo
```

Docker Compose uses `http://host.docker.internal:8080/v1/vin/photo` for the same host service when the ML container publishes host port `8080`.

If that service is not available, VIN photo scanning falls back to local Tesseract OCR. Docker installs Tesseract automatically. For local API development, install the system binary first:

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
nicherides/
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
          s3.py
        tasks/
          worker.py
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
