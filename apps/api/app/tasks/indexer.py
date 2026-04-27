from sqlmodel import Session, select
from app.db.session import engine
from app.models.car import CarListing, CarStatus
from app.services.opensearch import os_client, ensure_index
from app.core.config import settings

def index_car_listing(car_id: int) -> None:
    ensure_index()
    with Session(engine) as session:
        car = session.exec(select(CarListing).where(CarListing.id == car_id)).first()
        if not car:
            return

        c = os_client()
        index = settings.OPENSEARCH_INDEX

        if car.status != CarStatus.active:
            # keep search clean
            try:
                c.delete(index=index, id=str(car.id))
            except Exception:
                pass
            return

        doc = {
            "id": str(car.id),
            "status": car.status.value,
            "city": car.city,
            "district": car.district,
            "make_id": car.make_id,
            "model_id": car.model_id,
            "year": car.year,
            "price": car.price,
            "mileage": car.mileage,
            "body_type": car.body_type,
            "transmission": car.transmission,
            "fuel_type": car.fuel_type,
            "drivetrain": car.drivetrain,
            "condition": car.condition,
            "title_ar": car.title_ar,
            "description_ar": car.description_ar,
            "published_at": car.published_at.isoformat() if car.published_at else None,
        }
        c.index(index=index, id=str(car.id), body=doc, refresh=True)