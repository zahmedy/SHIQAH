from __future__ import annotations

import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from fastapi import HTTPException
from sqlmodel import Session, SQLModel, create_engine

from app.api.v1.routes.cars import archive_owner_car, restore_archived_owner_car
from app.api.v1.routes.search import _db_search_cars
from app.models.car import CarListing, CarStatus
from app.models.user import User, UserRole
from app.services.niche_scoring import BUDGET_DAILY_NICHE_ID, score_listing_for_niche
from app.services.search_intent import parse_search_intent


MILES_TO_KM = 1.60934


def miles(value: int) -> int:
    return round(value * MILES_TO_KM)


def make_listing(owner_id: int, **overrides) -> CarListing:
    data = {
        "owner_id": owner_id,
        "status": CarStatus.active,
        "city": "Buffalo",
        "make": "Toyota",
        "model": "Camry",
        "year": 2020,
        "price": 25000,
        "mileage": miles(75_000),
        "body_type": "Sedan",
        "transmission": "Automatic",
        "fuel_type": "Petrol",
        "drivetrain": "FWD",
        "engine_cylinders": 4,
        "condition": "used",
        "title": "Toyota Camry 2020 for sale",
        "description": "Clean title, no accidents, recent maintenance, and new tires.",
        "published_at": datetime.utcnow(),
    }
    data.update(overrides)
    return CarListing(**data)


class PreDeploymentSearchIntentTests(unittest.TestCase):
    def test_under_120k_miles_is_converted_to_database_kilometers(self) -> None:
        intent = parse_search_intent("budget friendly cars under 120k miles")

        self.assertEqual(intent["mileage_max"], miles(120_000))
        self.assertEqual(intent["sort"], "mileage_asc")

    def test_price_under_does_not_become_mileage_filter(self) -> None:
        intent = parse_search_intent("budget cars under $20k")

        self.assertEqual(intent["price_max"], 20_000)
        self.assertNotIn("mileage_max", intent)


class PreDeploymentNicheScoringTests(unittest.TestCase):
    def test_v8_daily_driver_scores_worse_than_four_cylinder(self) -> None:
        base_listing = {
            "mileage": miles(68_000),
            "body_type": "Sedan",
            "fuel_type": "Petrol",
            "condition": "used",
            "description": "Garage kept, clean title, no accidents, remote start.",
        }

        efficient = score_listing_for_niche({**base_listing, "engine_cylinders": 4}, BUDGET_DAILY_NICHE_ID)
        thirsty = score_listing_for_niche({**base_listing, "engine_cylinders": 8}, BUDGET_DAILY_NICHE_ID)

        self.assertGreater(efficient["score"], thirsty["score"])
        self.assertLessEqual(thirsty["score"], 55)
        self.assertIn("8-cylinder fuel cost", thirsty["warnings"])


class PreDeploymentListingLifecycleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        SQLModel.metadata.create_all(self.engine)

    def create_user_and_listing(
        self,
        *,
        status: CarStatus = CarStatus.active,
        user_id: str = "seller",
        phone_e164: str = "+15551234567",
        **listing_overrides,
    ):
        with Session(self.engine) as session:
            user = User(
                role=UserRole.seller,
                name="Seller",
                user_id=user_id,
                phone_e164=phone_e164,
                verified_at=datetime.utcnow(),
            )
            session.add(user)
            session.commit()
            session.refresh(user)

            listing = make_listing(user.id, status=status, **listing_overrides)
            session.add(listing)
            session.commit()
            session.refresh(listing)
            return user.id, listing.id

    def test_public_db_search_only_returns_active_visible_listings_under_mileage_cap(self) -> None:
        with Session(self.engine) as session:
            user = User(
                role=UserRole.seller,
                name="Seller",
                user_id="seller-search",
                phone_e164="+15550000000",
                verified_at=datetime.utcnow(),
            )
            session.add(user)
            session.commit()
            session.refresh(user)

            visible_boundary = make_listing(user.id, title="Boundary car", mileage=miles(120_000))
            too_many_miles = make_listing(user.id, title="High mileage car", mileage=miles(121_000))
            archived = make_listing(
                user.id,
                title="Archived car",
                status=CarStatus.expired,
                status_before_archive=CarStatus.active.value,
                archived_at=datetime.utcnow(),
                mileage=miles(80_000),
            )
            sold = make_listing(user.id, title="Sold car", status=CarStatus.sold, mileage=miles(60_000))
            session.add_all([visible_boundary, too_many_miles, archived, sold])
            session.commit()

            result = _db_search_cars(
                city=None,
                make=None,
                model=None,
                year_min=None,
                year_max=None,
                price_min=None,
                price_max=None,
                mileage_max=miles(120_000),
                transmission=None,
                fuel_type=None,
                drivetrain=None,
                body_type=None,
                lat=None,
                lon=None,
                radius_km=None,
                sort="mileage_asc",
                page=1,
                page_size=20,
                session=session,
            )

        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["title"], "Boundary car")

    def test_archive_hides_listing_and_restore_only_allows_active_archives(self) -> None:
        active_user_id, active_listing_id = self.create_user_and_listing(status=CarStatus.active)

        with Session(self.engine) as session:
            active_user = session.get(User, active_user_id)
            archived = archive_owner_car(active_listing_id, session=session, user=active_user)
            self.assertEqual(archived.status, CarStatus.expired.value)
            self.assertEqual(archived.status_before_archive, CarStatus.active.value)

            with patch("app.api.v1.routes.cars.upsert_car"):
                restored = restore_archived_owner_car(active_listing_id, session=session, user=active_user)
            self.assertEqual(restored.status, CarStatus.active.value)
            self.assertIsNone(restored.archived_at)

        draft_user_id, draft_listing_id = self.create_user_and_listing(
            status=CarStatus.draft,
            phone_e164="+15557654321",
            user_id="draft-seller",
        )
        with Session(self.engine) as session:
            draft_user = session.get(User, draft_user_id)
            archived_draft = archive_owner_car(draft_listing_id, session=session, user=draft_user)
            self.assertEqual(archived_draft.status_before_archive, CarStatus.draft.value)

            with self.assertRaises(HTTPException) as raised:
                restore_archived_owner_car(draft_listing_id, session=session, user=draft_user)
            self.assertEqual(raised.exception.status_code, 400)
            self.assertIn("active", raised.exception.detail)

    def test_restore_window_expires_after_30_days(self) -> None:
        user_id, listing_id = self.create_user_and_listing(
            status=CarStatus.expired,
            archived_at=datetime.utcnow() - timedelta(days=31),
            status_before_archive=CarStatus.active.value,
        )

        with Session(self.engine) as session:
            user = session.get(User, user_id)
            with self.assertRaises(HTTPException) as raised:
                restore_archived_owner_car(listing_id, session=session, user=user)

        self.assertEqual(raised.exception.status_code, 400)
        self.assertIn("30 days", raised.exception.detail)


if __name__ == "__main__":
    unittest.main()
