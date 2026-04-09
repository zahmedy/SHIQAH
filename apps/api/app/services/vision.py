def predict_car_attributes(photo_urls: list[str]) -> dict:
    # Stub predictor for plumbing validation. Replace this with a real
    # model or external vision service once the end-to-end pipeline works.
    photo_count = len(photo_urls)
    return {
        "source": "stub-v1",
        "make": "Toyota",
        "model": "Camry",
        "year_start": 2020,
        "year_end": 2022,
        "confidence": min(0.35 + photo_count * 0.1, 0.8),
        "raw": {
            "note": "stub result",
            "photo_count": photo_count,
            "photo_urls": photo_urls,
        },
    }
