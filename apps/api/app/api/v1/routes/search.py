from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.car import CarListing, CarMedia, CarStatus
from app.models.user import User
from app.services.city_proximity import nearby_cities
from app.services.niche_scoring import score_listing_for_all_niches
from app.services.search_intent import parse_search_intent

router = APIRouter(prefix="/search", tags=["search"])
MILES_TO_KM = 1.60934


def _radius_mi_to_km(radius_mi: int | None, radius_km: int | None = None) -> int | None:
    if not isinstance(radius_mi, int):
        radius_mi = None
    if not isinstance(radius_km, int):
        radius_km = None
    if radius_mi is not None:
        return max(1, round(radius_mi * MILES_TO_KM))
    return radius_km


def _photos_by_listing(session: Session, listing_ids: list[int]) -> dict[int, list[dict]]:
    if not listing_ids:
        return {}

    photos_by_listing_id: dict[int, list[dict]] = {}
    photos = session.exec(
        select(CarMedia)
        .where(CarMedia.car_id.in_(listing_ids))
        .order_by(CarMedia.car_id.asc(), CarMedia.is_cover.desc(), CarMedia.sort_order.asc(), CarMedia.id.asc())
    ).all()
    for photo in photos:
        photos_by_listing_id.setdefault(photo.car_id, []).append({
            "id": photo.id,
            "public_url": photo.public_url,
            "sort_order": photo.sort_order,
            "is_cover": photo.is_cover,
        })
    return photos_by_listing_id


def _seller_user_ids(session: Session, owner_ids: set[int]) -> dict[int, str]:
    if not owner_ids:
        return {}

    users = session.exec(select(User).where(User.id.in_(owner_ids))).all()
    return {
        user.id: user.user_id
        for user in users
        if user.id is not None and user.user_id
    }


def _search_item_from_listing(
    listing: CarListing,
    *,
    photos_by_listing_id: dict[int, list[dict]],
    seller_user_ids: dict[int, str],
) -> dict:
    return {
        "id": str(listing.id),
        "owner_id": listing.owner_id,
        "seller_user_id": seller_user_ids.get(listing.owner_id),
        "city": listing.city,
        "district": listing.district,
        "make": listing.make,
        "model": listing.model,
        "year": listing.year,
        "price": listing.price,
        "mileage": listing.mileage,
        "body_type": listing.body_type,
        "transmission": listing.transmission,
        "fuel_type": listing.fuel_type,
        "drivetrain": listing.drivetrain,
        "condition": listing.condition,
        "title": listing.title,
        "description": listing.description,
        "published_at": listing.published_at.isoformat() if listing.published_at else None,
        "photos": photos_by_listing_id.get(listing.id, []),
        "niche_scores": score_listing_for_all_niches(listing),
    }


def _db_search_cars(
    *,
    city: str | None,
    make: str | None,
    model: str | None,
    year_min: int | None,
    year_max: int | None,
    price_min: int | None,
    price_max: int | None,
    mileage_max: int | None,
    transmission: str | None,
    fuel_type: str | None,
    drivetrain: str | None,
    body_type: str | None,
    lat: float | None,
    lon: float | None,
    radius_km: int | None,
    keyword_query: str | None,
    sort: str,
    page: int,
    page_size: int,
    session: Session,
) -> dict:
    statement = select(CarListing).where(CarListing.status == CarStatus.active)
    if city:
        statement = statement.where(CarListing.city == city)
    elif lat is not None and lon is not None:
        statement = statement.where(CarListing.city.in_(nearby_cities(lat, lon, radius_km or 80)))
    if make:
        statement = statement.where(CarListing.make == make)
    if model:
        statement = statement.where(CarListing.model == model)
    if transmission:
        statement = statement.where(CarListing.transmission == transmission)
    if fuel_type:
        statement = statement.where(CarListing.fuel_type == fuel_type)
    if drivetrain:
        statement = statement.where(CarListing.drivetrain == drivetrain)
    if body_type:
        statement = statement.where(CarListing.body_type == body_type)
    if year_min is not None:
        statement = statement.where(CarListing.year >= year_min)
    if year_max is not None:
        statement = statement.where(CarListing.year <= year_max)
    if price_min is not None:
        statement = statement.where(CarListing.price != None, CarListing.price >= price_min)
    if price_max is not None:
        statement = statement.where(CarListing.price != None, CarListing.price <= price_max)
    if mileage_max is not None:
        statement = statement.where(CarListing.mileage != None, CarListing.mileage <= mileage_max)

    listings = list(session.exec(statement).all())
    if keyword_query:
        terms = [term for term in keyword_query.lower().split() if term]
        listings = [
            listing
            for listing in listings
            if _listing_matches_keywords(listing, terms)
        ]

    if sort == "price_asc":
        listings.sort(key=lambda listing: (listing.price is None, listing.price or 0, listing.published_at or listing.created_at), reverse=False)
    elif sort == "price_desc":
        listings.sort(key=lambda listing: (listing.price is not None, listing.price or 0, listing.published_at or listing.created_at), reverse=True)
    elif sort == "mileage_asc":
        listings.sort(key=lambda listing: (listing.mileage is None, listing.mileage or 0, listing.published_at or listing.created_at), reverse=False)
    else:
        listings.sort(key=lambda listing: listing.published_at or listing.created_at, reverse=True)

    total = len(listings)
    page_items = listings[(page - 1) * page_size: page * page_size]
    listing_ids = [listing.id for listing in page_items if listing.id is not None]
    photos_by_listing_id = _photos_by_listing(session, listing_ids)
    seller_user_ids = _seller_user_ids(session, {listing.owner_id for listing in page_items})
    return {
        "page": page,
        "page_size": page_size,
        "total": total,
        "items": [
            _search_item_from_listing(
                listing,
                photos_by_listing_id=photos_by_listing_id,
                seller_user_ids=seller_user_ids,
            )
            for listing in page_items
        ],
    }


def _listing_matches_keywords(listing: CarListing, terms: list[str]) -> bool:
    if not terms:
        return True
    haystack = " ".join(
        str(value or "")
        for value in (
            listing.title,
            listing.description,
            listing.make,
            listing.model,
            listing.city,
            listing.body_type,
            listing.fuel_type,
            listing.drivetrain,
        )
    ).lower()
    return all(term in haystack for term in terms)


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
    drivetrain: str | None = None,
    body_type: str | None = None,
    lat: float | None = Query(default=None, ge=-90, le=90),
    lon: float | None = Query(default=None, ge=-180, le=180),
    radius_mi: int | None = Query(default=None, ge=1, le=500),
    radius_km: int | None = Query(default=None, ge=1, le=805),

    sort: str = Query(default="newest", pattern="^(newest|price_asc|price_desc|mileage_asc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=50),
    session: Session = Depends(get_session),
):
    intent = parse_search_intent(q)
    intent_keywords = " ".join(intent.get("keywords", []))

    city = city or intent.get("city")
    make = make or intent.get("make")
    model = model or intent.get("model")
    year_min = year_min if year_min is not None else intent.get("year_min")
    year_max = year_max if year_max is not None else intent.get("year_max")
    price_min = price_min if price_min is not None else intent.get("price_min")
    price_max = price_max if price_max is not None else intent.get("price_max")
    mileage_max = mileage_max if mileage_max is not None else intent.get("mileage_max")
    transmission = transmission or intent.get("transmission")
    fuel_type = fuel_type or intent.get("fuel_type")
    drivetrain = drivetrain or intent.get("drivetrain")
    body_type = body_type or intent.get("body_type")
    if sort == "newest" and intent.get("sort"):
        sort = intent["sort"]
    radius_distance_km = _radius_mi_to_km(radius_mi, radius_km)

    text_query = intent_keywords if intent else q
    return _db_search_cars(
        city=city,
        make=make,
        model=model,
        year_min=year_min,
        year_max=year_max,
        price_min=price_min,
        price_max=price_max,
        mileage_max=mileage_max,
        transmission=transmission,
        fuel_type=fuel_type,
        drivetrain=drivetrain,
        body_type=body_type,
        lat=lat,
        lon=lon,
        radius_km=radius_distance_km,
        keyword_query=text_query,
        sort=sort,
        page=page,
        page_size=page_size,
        session=session,
    )
