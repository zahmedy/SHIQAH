from opensearchpy import OpenSearch
from app.core.config import settings

def client() -> OpenSearch:
    return OpenSearch(hosts=[settings.OPENSEARCH_URL])

def ensure_index() -> None:
    c = client()
    idx = settings.OPENSEARCH_INDEX
    if c.indices.exists(index=idx):
        try:
            c.indices.put_mapping(
                index=idx,
                body={
                    "properties": {
                        "location": {"type": "geo_point"},
                        "seller_name": {"type": "text"},
                        "seller_user_id": {"type": "keyword"},
                        "owner_id": {"type": "integer"},
                        "fuel_type": {"type": "keyword"},
                        "drivetrain": {"type": "keyword"},
                        "body_type": {"type": "keyword"},
                        "price": {"type": "integer"},
                        "mileage": {"type": "integer"},
                    }
                },
            )
        except Exception:
            pass
        return

    mapping = {
        "mappings": {
            "properties": {
                "id": {"type": "keyword"},
                "owner_id": {"type": "integer"},
                "seller_user_id": {"type": "keyword"},
                "city": {"type": "keyword"},
                "district": {"type": "keyword"},
                "make": {"type": "keyword"},
                "model": {"type": "keyword"},
                "year": {"type": "integer"},
                "price": {"type": "integer"},
                "mileage": {"type": "integer"},
                "body_type": {"type": "keyword"},
                "transmission": {"type": "keyword"},
                "fuel_type": {"type": "keyword"},
                "drivetrain": {"type": "keyword"},
                "condition": {"type": "keyword"},
                "seller_name": {"type": "text"},
                "title_ar": {"type": "text"},
                "description_ar": {"type": "text"},
                "published_at": {"type": "date"},
                "location": {"type": "geo_point"},
            }
        }
    }
    c.indices.create(index=idx, body=mapping)

def upsert_car(doc_id: str, doc: dict) -> None:
    ensure_index()
    c = client()
    c.index(index=settings.OPENSEARCH_INDEX, id=doc_id, body=doc, refresh=True)

def delete_car(doc_id: str) -> None:
    ensure_index()
    c = client()
    try:
        c.delete(index=settings.OPENSEARCH_INDEX, id=doc_id, refresh=True)
    except Exception:
        pass
