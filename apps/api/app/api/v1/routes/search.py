from fastapi import APIRouter, Depends, HTTPException, Query
from opensearchpy.exceptions import ConnectionError as OpenSearchConnectionError
from opensearchpy.exceptions import TransportError
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.user import User
from app.services.opensearch import client, ensure_index
from app.services.city_proximity import nearby_cities
from app.core.config import settings

router = APIRouter(prefix="/search", tags=["search"])

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
    lat: float | None = Query(default=None, ge=-90, le=90),
    lon: float | None = Query(default=None, ge=-180, le=180),
    radius_km: int | None = Query(default=None, ge=1, le=500),

    sort: str = Query(default="newest", pattern="^(newest|price_asc|price_desc|mileage_asc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    session: Session = Depends(get_session),
):
    try:
        ensure_index()
        c = client()
    except (OpenSearchConnectionError, TransportError) as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Search service unavailable. Start OpenSearch at {settings.OPENSEARCH_URL}.",
        ) from exc

    filters: list[dict] = []
    if city:
        filters.append({"term": {"city": city}})
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
    if lat is not None and lon is not None:
        distance_km = radius_km or 50
        location_should: list[dict] = [
            {
                "geo_distance": {
                    "distance": f"{distance_km}km",
                    "location": {"lat": lat, "lon": lon},
                }
            }
        ]

        if not city:
            city_matches = nearby_cities(lat, lon, distance_km)
            if city_matches:
                location_should.append({"terms": {"city": city_matches}})

        filters.append({
            "bool": {
                "should": location_should,
                "minimum_should_match": 1,
            }
        })

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

    try:
        res = c.search(index=settings.OPENSEARCH_INDEX, body=body)
    except (OpenSearchConnectionError, TransportError) as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Search service unavailable. Start OpenSearch at {settings.OPENSEARCH_URL}.",
        ) from exc

    hits = res["hits"]["hits"]
    total = res["hits"]["total"]["value"] if isinstance(res["hits"]["total"], dict) else res["hits"]["total"]

    items = [h["_source"] for h in hits]
    owner_ids = {
        int(item["owner_id"])
        for item in items
        if item.get("owner_id") is not None
    }
    seller_user_ids: dict[int, str] = {}
    if owner_ids:
        users = session.exec(select(User).where(User.id.in_(owner_ids))).all()
        seller_user_ids = {
            user.id: user.user_id
            for user in users
            if user.id is not None and user.user_id
        }

    for item in items:
        owner_id = item.get("owner_id")
        if owner_id is None:
            continue
        seller_user_id = seller_user_ids.get(int(owner_id))
        if seller_user_id:
            item["seller_user_id"] = seller_user_id

    return {"page": page, "page_size": page_size, "total": total, "items": items}
