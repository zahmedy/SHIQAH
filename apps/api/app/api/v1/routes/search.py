from fastapi import APIRouter, Query
from app.services.opensearch import client, ensure_index
from app.core.config import settings

router = APIRouter(prefix="/v1/search", tags=["search"])

@router.get("/cars")
def search_cars(
    q: str | None = None,
    city: str | None = None,
    make: str | None = None,
    model: str | None = None,

    year_min: int | None = None,
    year_max: int | None = None,
    price_min: int | None = None,
    price_max: int | None = None,
    mileage_max: int | None = None,

    transmission: str | None = None,
    fuel_type: str | None = None,
    body_type: str | None = None,

    sort: str = Query(default="newest", pattern="^(newest|price_asc|price_desc|mileage_asc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
):
    ensure_index()
    c = client()

    filters: list[dict] = []
    if city: filters.append({"term": {"city": city}})
    if make: filters.append({"term": {"make": make}})
    if model: filters.append({"term": {"model": model}})
    if transmission: filters.append({"term": {"transmission": transmission}})
    if fuel_type: filters.append({"term": {"fuel_type": fuel_type}})
    if body_type: filters.append({"term": {"body_type": body_type}})

    if year_min is not None or year_max is not None:
        r = {}
        if year_min is not None: r["gte"] = year_min
        if year_max is not None: r["lte"] = year_max
        filters.append({"range": {"year": r}})

    if price_min is not None or price_max is not None:
        r = {}
        if price_min is not None: r["gte"] = price_min
        if price_max is not None: r["lte"] = price_max
        filters.append({"range": {"price_sar": r}})

    if mileage_max is not None:
        filters.append({"range": {"mileage_km": {"lte": mileage_max}}})

    must: list[dict] = []
    if q:
        must.append({
            "multi_match": {
                "query": q,
                "fields": ["title_ar", "description_ar"],
            }
        })

    body = {
        "from": (page - 1) * page_size,
        "size": page_size,
        "query": {
            "bool": {
                "filter": filters,
                "must": must if must else [{"match_all": {}}],
            }
        }
    }

    if sort == "newest":
        body["sort"] = [{"published_at": {"order": "desc"}}]
    elif sort == "price_asc":
        body["sort"] = [{"price_sar": {"order": "asc"}}]
    elif sort == "price_desc":
        body["sort"] = [{"price_sar": {"order": "desc"}}]
    elif sort == "mileage_asc":
        body["sort"] = [{"mileage_km": {"order": "asc"}}]

    res = c.search(index=settings.OPENSEARCH_INDEX, body=body)

    hits = res["hits"]["hits"]
    total = res["hits"]["total"]["value"] if isinstance(res["hits"]["total"], dict) else res["hits"]["total"]

    items = [h["_source"] for h in hits]
    return {"page": page, "page_size": page_size, "total": total, "items": items}