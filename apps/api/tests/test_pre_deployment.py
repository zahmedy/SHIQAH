from __future__ import annotations

import unittest
from datetime import datetime, timedelta
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse
from unittest.mock import ANY, patch

from fastapi import HTTPException
from opensearchpy.exceptions import ConnectionError as OpenSearchConnectionError
from sqlmodel import Session, SQLModel, create_engine, select

from app.api.v1.routes.auth import (
    _create_apple_state,
    _create_google_state,
    _google_redirect_uri,
    _handle_apple_callback,
    _login_success_url,
    google_callback,
    request_email_code,
    start_apple_login,
    start_google_login,
    verify_email_code,
)
from app.api.v1.routes.activity import create_activity_event
from app.api.v1.routes.comments import create_comment, list_comments
from app.api.v1.routes.me import MeUpdate, update_me
from app.api.v1.routes.cars import (
    _normalize_typed_vin_or_raise,
    archive_owner_car,
    create_car,
    my_saved_cars,
    restore_archived_owner_car,
    save_car,
    saved_car_status,
    unsave_car,
)
from app.api.v1.routes.leads import (
    accept_offer,
    counter_offer,
    create_offer,
    get_manage_offers,
    get_offers,
    reject_offer,
)
from app.api.v1.routes.public import public_car_detail
from app.api.v1.routes.search import _db_search_cars, search_cars
from app.models.car import CarListing, CarStatus
from app.models.notification import Notification
from app.models.user import User, UserRole
from app.schemas.auth import EmailCodeRequest, EmailCodeVerify
from app.schemas.car import CarCreate, DescriptionFillRequest
from app.schemas.activity import ActivityEventCreate
from app.schemas.chat import ChatMessageCreate
from app.schemas.lead import CounterOfferCreate, OfferCreate
from app.services.description import generate_listing_description
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


class PreDeploymentVinTests(unittest.TestCase):
    def test_typed_vin_rejects_bad_check_digit_with_actionable_message(self) -> None:
        with self.assertRaises(HTTPException) as raised:
            _normalize_typed_vin_or_raise("2C4RC1BG6DR669714")

        self.assertEqual(raised.exception.status_code, 400)
        self.assertIn("9th character", raised.exception.detail)
        self.assertIn("2C4RC1BG3DR669714", raised.exception.detail)

    def test_typed_vin_accepts_same_vin_with_correct_check_digit(self) -> None:
        self.assertEqual(_normalize_typed_vin_or_raise("2C4RC1BG3DR669714"), "2C4RC1BG3DR669714")


class PreDeploymentDescriptionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        SQLModel.metadata.create_all(self.engine)

    def test_description_generator_keeps_seller_confirmed_highlights(self) -> None:
        description = generate_listing_description(
            DescriptionFillRequest(
                make="Toyota",
                model="RAV4",
                year=2019,
                city="Buffalo",
                mileage=85000,
                seller_highlights=["clean title", "winter tires"],
            )
        )

        self.assertIn("Seller-confirmed highlights: clean title, winter tires.", description)
        self.assertNotIn("Make:", description)
        self.assertNotIn("Model:", description)

    def test_create_car_allows_missing_description(self) -> None:
        with Session(self.engine) as session:
            seller = User(role=UserRole.seller, name="Seller", email="optional-description@example.com")
            session.add(seller)
            session.commit()
            session.refresh(seller)

            car = create_car(
                CarCreate(city="Buffalo", make="Toyota", model="RAV4", year=2019),
                session=session,
                user=seller,
            )

        self.assertEqual(car.description, "")
        self.assertEqual(car.title, "Toyota RAV4 2019 for sale")


class PreDeploymentAuthTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        SQLModel.metadata.create_all(self.engine)

    def test_email_code_login_creates_user_without_phone(self) -> None:
        with Session(self.engine) as session:
            with (
                patch("app.api.v1.routes.auth._generate_email_code", return_value="123456"),
                patch("app.api.v1.routes.auth.send_email_code"),
            ):
                request_result = request_email_code(EmailCodeRequest(email="Driver@Example.com"), session=session)
                token_result = verify_email_code(
                    EmailCodeVerify(email="Driver@Example.com", code="123456", name="Driver"),
                    session=session,
                )
            user = session.exec(select(User).where(User.email == "driver@example.com")).first()

        self.assertTrue(request_result["needs_name"])
        self.assertEqual(request_result["dev_code"], "123456")
        self.assertTrue(token_result.access_token)
        self.assertIsNotNone(user)
        self.assertEqual(user.phone_e164, None)
        self.assertEqual(user.name, "Driver")

    def test_email_code_rejects_invalid_code(self) -> None:
        with Session(self.engine) as session:
            with (
                patch("app.api.v1.routes.auth._generate_email_code", return_value="123456"),
                patch("app.api.v1.routes.auth.send_email_code"),
            ):
                request_email_code(EmailCodeRequest(email="Driver@Example.com"), session=session)
            with self.assertRaises(HTTPException) as raised:
                verify_email_code(
                    EmailCodeVerify(email="Driver@Example.com", code="654321", name="Driver"),
                    session=session,
                )

        self.assertEqual(raised.exception.status_code, 400)

    def test_google_callback_creates_email_user_and_redirects_with_token(self) -> None:
        request = SimpleNamespace(
            headers={"host": "localhost:8000"},
            url=SimpleNamespace(scheme="http", netloc="localhost:8000"),
        )
        with patch("app.api.v1.routes.auth.settings.GOOGLE_LOGIN_SUCCESS_URL", None):
            state = _create_google_state(request)

        with Session(self.engine) as session:
            with (
                patch("app.api.v1.routes.auth.settings.GOOGLE_LOGIN_SUCCESS_URL", None),
                patch("app.api.v1.routes.auth._exchange_google_code", return_value={"access_token": "google-token"}),
                patch(
                    "app.api.v1.routes.auth._fetch_google_userinfo",
                    return_value={"email": "driver@example.com", "email_verified": True, "name": "Driver"},
                ),
            ):
                response = google_callback(request, code="code", state=state, session=session)
            user = session.exec(select(User).where(User.email == "driver@example.com")).first()

        self.assertEqual(response.status_code, 302)
        self.assertIn("http://localhost:3001/login#access_token=", response.headers["location"])
        self.assertIsNotNone(user)
        self.assertEqual(user.name, "Driver")

    def test_google_callback_redirects_native_app_with_token(self) -> None:
        request = SimpleNamespace(
            headers={"x-forwarded-host": "api.nicherides.com", "x-forwarded-proto": "https"},
            url=SimpleNamespace(scheme="http", netloc="api:8000"),
        )
        with patch("app.api.v1.routes.auth.settings.GOOGLE_ALLOWED_SUCCESS_URLS", "nicherides://auth"):
            state = _create_google_state(request, "nicherides://auth")

        with Session(self.engine) as session:
            with (
                patch("app.api.v1.routes.auth.settings.GOOGLE_ALLOWED_SUCCESS_URLS", "nicherides://auth"),
                patch("app.api.v1.routes.auth._exchange_google_code", return_value={"access_token": "google-token"}),
                patch(
                    "app.api.v1.routes.auth._fetch_google_userinfo",
                    return_value={"email": "driver-native@example.com", "email_verified": True, "name": "Driver"},
                ),
            ):
                response = google_callback(request, code="code", state=state, session=session)
            user = session.exec(select(User).where(User.email == "driver-native@example.com")).first()

        parsed_location = urlparse(response.headers["location"])
        query = parse_qs(parsed_location.query)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(f"{parsed_location.scheme}://{parsed_location.netloc}{parsed_location.path}", "nicherides://auth")
        self.assertTrue(query["access_token"][0])
        self.assertIsNotNone(user)

    def test_google_callback_redirects_native_app_with_error(self) -> None:
        request = SimpleNamespace(
            headers={"x-forwarded-host": "api.nicherides.com", "x-forwarded-proto": "https"},
            url=SimpleNamespace(scheme="http", netloc="api:8000"),
        )
        with patch("app.api.v1.routes.auth.settings.GOOGLE_ALLOWED_SUCCESS_URLS", "nicherides://auth"):
            state = _create_google_state(request, "nicherides://auth")

        with Session(self.engine) as session:
            with patch("app.api.v1.routes.auth.settings.GOOGLE_ALLOWED_SUCCESS_URLS", "nicherides://auth"):
                response = google_callback(request, error="access_denied", state=state, session=session)

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["location"], "nicherides://auth?auth_error=access_denied")

    def test_google_start_rejects_unapproved_callback_url(self) -> None:
        request = SimpleNamespace(
            headers={"x-forwarded-host": "api.nicherides.com", "x-forwarded-proto": "https"},
            url=SimpleNamespace(scheme="http", netloc="api:8000"),
        )

        with (
            patch("app.api.v1.routes.auth.settings.GOOGLE_CLIENT_ID", "client"),
            patch("app.api.v1.routes.auth.settings.GOOGLE_CLIENT_SECRET", "secret"),
            patch("app.api.v1.routes.auth.settings.GOOGLE_ALLOWED_SUCCESS_URLS", "nicherides://auth"),
            self.assertRaises(HTTPException) as raised,
        ):
            start_google_login(request, callback_url="https://evil.example/auth")

        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(raised.exception.detail, "Invalid Google auth callback URL")

    def test_apple_callback_creates_email_user_and_redirects_with_token(self) -> None:
        request = SimpleNamespace(
            headers={"host": "localhost:8000"},
            url=SimpleNamespace(scheme="http", netloc="localhost:8000"),
        )
        with patch("app.api.v1.routes.auth.settings.APPLE_LOGIN_SUCCESS_URL", None):
            state = _create_apple_state(request)

        user_payload = '{"name":{"firstName":"Apple","lastName":"Driver"}}'
        with Session(self.engine) as session:
            with (
                patch("app.api.v1.routes.auth.settings.APPLE_LOGIN_SUCCESS_URL", None),
                patch("app.api.v1.routes.auth._exchange_apple_code", return_value={"id_token": "apple-token"}),
                patch(
                    "app.api.v1.routes.auth._decode_apple_id_token",
                    return_value={"email": "apple@example.com", "email_verified": "true"},
                ),
            ):
                response = _handle_apple_callback(
                    request,
                    session,
                    code="code",
                    state=state,
                    user=user_payload,
                )
            user = session.exec(select(User).where(User.email == "apple@example.com")).first()

        self.assertEqual(response.status_code, 302)
        self.assertIn("http://localhost:3001/login#access_token=", response.headers["location"])
        self.assertIsNotNone(user)
        self.assertEqual(user.name, "Apple Driver")

    def test_apple_start_rejects_unapproved_callback_url(self) -> None:
        request = SimpleNamespace(
            headers={"x-forwarded-host": "api.nicherides.com", "x-forwarded-proto": "https"},
            url=SimpleNamespace(scheme="http", netloc="api:8000"),
        )

        with (
            patch("app.api.v1.routes.auth.settings.APPLE_CLIENT_ID", "client"),
            patch("app.api.v1.routes.auth.settings.APPLE_TEAM_ID", "team"),
            patch("app.api.v1.routes.auth.settings.APPLE_KEY_ID", "key"),
            patch("app.api.v1.routes.auth.settings.APPLE_PRIVATE_KEY", "private"),
            patch("app.api.v1.routes.auth.settings.APPLE_ALLOWED_SUCCESS_URLS", "nicherides://auth"),
            self.assertRaises(HTTPException) as raised,
        ):
            start_apple_login(request, callback_url="https://evil.example/auth")

        self.assertEqual(raised.exception.status_code, 400)
        self.assertEqual(raised.exception.detail, "Invalid Apple auth callback URL")

    def test_apple_callback_passes_apple_access_token_to_id_token_decoder(self) -> None:
        request = SimpleNamespace(
            headers={"host": "localhost:8000"},
            url=SimpleNamespace(scheme="http", netloc="localhost:8000"),
        )
        with patch("app.api.v1.routes.auth.settings.APPLE_LOGIN_SUCCESS_URL", None):
            state = _create_apple_state(request)

        with Session(self.engine) as session:
            with (
                patch("app.api.v1.routes.auth.settings.APPLE_LOGIN_SUCCESS_URL", None),
                patch(
                    "app.api.v1.routes.auth._exchange_apple_code",
                    return_value={"id_token": "apple-id-token", "access_token": "apple-access-token"},
                ),
                patch(
                    "app.api.v1.routes.auth._decode_apple_id_token",
                    return_value={"email": "hash-check@example.com", "email_verified": "true"},
                ) as decode_id_token,
            ):
                response = _handle_apple_callback(request, session, code="code", state=state)

        self.assertEqual(response.status_code, 302)
        decode_id_token.assert_called_once_with("apple-id-token", ANY, "apple-access-token")

    def test_google_urls_ignore_localhost_config_on_public_origin(self) -> None:
        request = SimpleNamespace(
            headers={"x-forwarded-host": "nicherides.com", "x-forwarded-proto": "https"},
            url=SimpleNamespace(scheme="http", netloc="api:8000"),
        )

        with (
            patch(
                "app.api.v1.routes.auth.settings.GOOGLE_REDIRECT_URI",
                "http://localhost:8000/v1/auth/google/callback",
            ),
            patch("app.api.v1.routes.auth.settings.GOOGLE_LOGIN_SUCCESS_URL", "http://localhost:3001/login"),
        ):
            redirect_uri = _google_redirect_uri(request)
            success_url = _login_success_url(request)

        self.assertEqual(redirect_uri, "https://nicherides.com/v1/auth/google/callback")
        self.assertEqual(success_url, "https://nicherides.com/login")

    def test_direct_messaging_requires_phone_and_normalizes_number(self) -> None:
        with Session(self.engine) as session:
            user = User(
                role=UserRole.seller,
                name="Seller",
                email="seller@example.com",
                verified_at=datetime.utcnow(),
            )
            session.add(user)
            session.commit()
            session.refresh(user)
            user_id = user.id

            with self.assertRaises(HTTPException) as raised:
                update_me(MeUpdate(contact_text_enabled=True), session=session, user=user)
            self.assertEqual(raised.exception.status_code, 400)

            result = update_me(
                MeUpdate(
                    phone_e164="555-555-0123",
                    contact_text_enabled=True,
                    contact_whatsapp_enabled=True,
                ),
                session=session,
                user=user,
            )

        self.assertEqual(result["phone_e164"], "+15555550123")
        self.assertTrue(result["contact_text_enabled"])
        self.assertTrue(result["contact_whatsapp_enabled"])


class PreDeploymentSavedCarTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        SQLModel.metadata.create_all(self.engine)

    def test_user_can_save_list_and_unsave_active_car(self) -> None:
        with Session(self.engine) as session:
            seller = User(email="seller@example.com")
            buyer = User(email="buyer@example.com")
            session.add(seller)
            session.add(buyer)
            session.commit()
            session.refresh(seller)
            session.refresh(buyer)

            car = make_listing(owner_id=seller.id or 0)
            session.add(car)
            session.commit()
            session.refresh(car)
            car_id = car.id or 0

            saved = save_car(car_id, session=session, user=buyer)
            status = saved_car_status(car_id, session=session, user=buyer)
            saved_cars = my_saved_cars(session=session, user=buyer)
            removed = unsave_car(car_id, session=session, user=buyer)

        self.assertEqual(saved.car_id, car_id)
        self.assertTrue(saved.saved)
        self.assertTrue(status.saved)
        self.assertEqual(len(saved_cars), 1)
        self.assertEqual(saved_cars[0].listing.id, car_id)
        self.assertFalse(removed.saved)


class PreDeploymentActivityEventTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        SQLModel.metadata.create_all(self.engine)

    def test_activity_event_supports_anonymous_and_user_context(self) -> None:
        with Session(self.engine) as session:
            user = User(email="activity@example.com")
            session.add(user)
            session.commit()
            session.refresh(user)
            user_id = user.id

            anonymous = create_activity_event(
                ActivityEventCreate(
                    event_type="search",
                    session_id="anon-session",
                    source="search_page",
                    search_query="awd suv",
                    filters={"drivetrain": "AWD"},
                    metadata={"result_count": 3},
                ),
                session=session,
                user=None,
            )
            logged_in = create_activity_event(
                ActivityEventCreate(
                    event_type="listing_view",
                    session_id="user-session",
                    car_id=123,
                    source="car_detail",
                ),
                session=session,
                user=user,
            )

        self.assertEqual(anonymous.event_type, "search")
        self.assertIsNone(anonymous.user_id)
        self.assertEqual(anonymous.session_id, "anon-session")
        self.assertEqual(logged_in.user_id, user_id)
        self.assertEqual(logged_in.car_id, 123)


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
                keyword_query=None,
                sort="mileage_asc",
                page=1,
                page_size=20,
                session=session,
            )

        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["title"], "Boundary car")

    def test_public_car_detail_includes_email_contact_when_seller_has_email(self) -> None:
        with Session(self.engine) as session:
            user = User(
                role=UserRole.seller,
                name="Seller",
                user_id="email-seller",
                email="seller@example.com",
                verified_at=datetime.utcnow(),
            )
            session.add(user)
            session.commit()
            session.refresh(user)

            listing = make_listing(user.id, make="Mazda", model="CX-90", year=2024)
            session.add(listing)
            session.commit()
            session.refresh(listing)

            result = public_car_detail(listing.id, session=session)

        self.assertIn("mailto:seller@example.com", result["contact"]["email_url"])
        self.assertIn("Question%20about%202024%20Mazda%20CX-90", result["contact"]["email_url"])

    def test_offer_lists_show_only_each_buyers_latest_private_offer(self) -> None:
        with Session(self.engine) as session:
            owner = User(role=UserRole.seller, name="Owner", email="owner@example.com", verified_at=datetime.utcnow())
            buyer = User(role=UserRole.buyer, name="Buyer", email="buyer@example.com", verified_at=datetime.utcnow())
            session.add(owner)
            session.add(buyer)
            session.commit()
            session.refresh(owner)
            session.refresh(buyer)

            listing = make_listing(owner.id, public_bidding_enabled=True)
            session.add(listing)
            session.commit()
            session.refresh(listing)

            first_offer = create_offer(listing.id, OfferCreate(amount=10_000), session=session, user=buyer)
            latest_offer = create_offer(listing.id, OfferCreate(amount=12_000), session=session, user=buyer)

            owner_summary = get_manage_offers(listing.id, session=session, user=owner)
            buyer_summary = get_offers(listing.id, session=session, user=buyer)
            public_summary = get_offers(listing.id, session=session, user=None)
            owner_notifications = session.exec(
                select(Notification).where(Notification.user_id == owner.id, Notification.type == "offer_created")
            ).all()

        self.assertEqual(first_offer.amount, 10_000)
        self.assertEqual(latest_offer.amount, 12_000)
        self.assertEqual(owner_summary.offer_count, 1)
        self.assertEqual(len(owner_summary.offers), 1)
        self.assertEqual(owner_summary.offers[0].amount, 12_000)
        self.assertEqual(owner_summary.offers[0].visibility, "private")
        self.assertEqual(buyer_summary.list_price, listing.price)
        self.assertEqual(len(buyer_summary.offers), 1)
        self.assertEqual(buyer_summary.offers[0].amount, 12_000)
        self.assertEqual(public_summary.offers, [])
        self.assertEqual(len(owner_notifications), 2)

    def test_repeat_offer_replaces_buyers_current_offer(self) -> None:
        with Session(self.engine) as session:
            owner = User(role=UserRole.seller, name="Owner", email="owner-repeat@example.com", verified_at=datetime.utcnow())
            buyer = User(role=UserRole.buyer, name="Buyer", email="buyer-repeat@example.com", verified_at=datetime.utcnow())
            session.add(owner)
            session.add(buyer)
            session.commit()
            session.refresh(owner)
            session.refresh(buyer)

            listing = make_listing(owner.id, public_bidding_enabled=True)
            session.add(listing)
            session.commit()
            session.refresh(listing)

            first_offer = create_offer(listing.id, OfferCreate(amount=12_000), session=session, user=buyer)
            lower_offer = create_offer(listing.id, OfferCreate(amount=11_000), session=session, user=buyer)
            higher_offer = create_offer(listing.id, OfferCreate(amount=13_000), session=session, user=buyer)

            owner_summary = get_manage_offers(listing.id, session=session, user=owner)
            buyer_summary = get_offers(listing.id, session=session, user=buyer)
            public_summary = get_offers(listing.id, session=session, user=None)

        self.assertEqual(first_offer.amount, 12_000)
        self.assertEqual(lower_offer.amount, 11_000)
        self.assertEqual(higher_offer.amount, 13_000)
        self.assertEqual(owner_summary.offer_count, 1)
        self.assertEqual(owner_summary.offers[0].amount, 13_000)
        self.assertEqual(buyer_summary.list_price, listing.price)
        self.assertEqual(buyer_summary.offers[0].amount, 13_000)
        self.assertEqual(public_summary.highest_offer, None)
        self.assertEqual(public_summary.offers, [])

    def test_reject_offer_rejects_current_buyer_offer_without_resurrecting_lower_bids(self) -> None:
        with Session(self.engine) as session:
            owner = User(role=UserRole.seller, name="Owner", email="owner2@example.com", verified_at=datetime.utcnow())
            buyer = User(role=UserRole.buyer, name="Buyer", email="buyer2@example.com", verified_at=datetime.utcnow())
            session.add(owner)
            session.add(buyer)
            session.commit()
            session.refresh(owner)
            session.refresh(buyer)

            listing = make_listing(owner.id, public_bidding_enabled=True)
            session.add(listing)
            session.commit()
            session.refresh(listing)

            create_offer(listing.id, OfferCreate(amount=10_000, visibility="public"), session=session, user=buyer)
            private_offer = create_offer(listing.id, OfferCreate(amount=12_000, visibility="private"), session=session, user=buyer)

            reject_offer(listing.id, private_offer.id, session=session, user=owner)
            owner_summary = get_manage_offers(listing.id, session=session, user=owner)
            public_summary = get_offers(listing.id, session=session, user=None)
            buyer_notifications = session.exec(
                select(Notification).where(Notification.user_id == buyer.id, Notification.type == "offer_rejected")
            ).all()
            listing_id = listing.id

        self.assertEqual(owner_summary.offer_count, 0)
        self.assertEqual(owner_summary.offers, [])
        self.assertEqual(public_summary.highest_offer, None)
        self.assertEqual(public_summary.offers, [])
        self.assertEqual(len(buyer_notifications), 1)
        self.assertEqual(buyer_notifications[0].car_id, listing_id)

    def test_counteroffer_must_be_accepted_by_original_bidder(self) -> None:
        with Session(self.engine) as session:
            owner = User(role=UserRole.seller, name="Owner", email="counter-owner@example.com", verified_at=datetime.utcnow())
            buyer = User(role=UserRole.buyer, name="Buyer", email="counter-buyer@example.com", verified_at=datetime.utcnow())
            other_buyer = User(role=UserRole.buyer, name="Other", email="counter-other@example.com", verified_at=datetime.utcnow())
            session.add(owner)
            session.add(buyer)
            session.add(other_buyer)
            session.commit()
            session.refresh(owner)
            session.refresh(buyer)
            session.refresh(other_buyer)

            listing = make_listing(owner.id)
            session.add(listing)
            session.commit()
            session.refresh(listing)

            offer = create_offer(listing.id, OfferCreate(amount=18_000), session=session, user=buyer)
            counter = counter_offer(
                listing.id,
                offer.id,
                CounterOfferCreate(amount=19_000),
                session=session,
                user=owner,
            )

            with self.assertRaises(HTTPException) as owner_error:
                accept_offer(listing.id, counter.id, session=session, user=owner)
            with self.assertRaises(HTTPException) as other_error:
                accept_offer(listing.id, counter.id, session=session, user=other_buyer)

            accepted_counter = accept_offer(listing.id, counter.id, session=session, user=buyer)
            owner_summary = get_manage_offers(listing.id, session=session, user=owner)
            owner_notifications = session.exec(
                select(Notification).where(Notification.user_id == owner.id, Notification.type == "offer_accepted")
            ).all()

        self.assertEqual(owner_error.exception.status_code, 403)
        self.assertEqual(other_error.exception.status_code, 403)
        self.assertEqual(accepted_counter.amount, 19_000)
        self.assertTrue(accepted_counter.is_counteroffer)
        self.assertIsNotNone(accepted_counter.accepted_at)
        self.assertFalse(owner_summary.offers_open)
        self.assertEqual(owner_summary.accepted_offer.amount, 19_000)
        self.assertEqual(len(owner_notifications), 1)
        self.assertEqual(owner_notifications[0].title, "Counteroffer accepted")

    def test_comment_creates_owner_notification(self) -> None:
        with Session(self.engine) as session:
            owner = User(role=UserRole.seller, name="Owner", email="comment-owner@example.com", verified_at=datetime.utcnow())
            commenter = User(role=UserRole.buyer, name="Commenter", email="commenter@example.com", verified_at=datetime.utcnow())
            session.add(owner)
            session.add(commenter)
            session.commit()
            session.refresh(owner)
            session.refresh(commenter)

            listing = make_listing(owner.id)
            session.add(listing)
            session.commit()
            session.refresh(listing)

            create_comment(listing.id, ChatMessageCreate(message="Is this still available?"), session=session, user=commenter)
            notification = session.exec(
                select(Notification).where(Notification.user_id == owner.id, Notification.type == "comment_created")
            ).first()
            listing_id = listing.id

        self.assertIsNotNone(notification)
        self.assertEqual(notification.car_id, listing_id)

    def test_comments_are_publicly_readable(self) -> None:
        with Session(self.engine) as session:
            owner = User(role=UserRole.seller, name="Owner", email="public-comment-owner@example.com", verified_at=datetime.utcnow())
            commenter = User(role=UserRole.buyer, name="Commenter", user_id="public-commenter", email="public-commenter@example.com", verified_at=datetime.utcnow())
            session.add(owner)
            session.add(commenter)
            session.commit()
            session.refresh(owner)
            session.refresh(commenter)

            listing = make_listing(owner.id)
            session.add(listing)
            session.commit()
            session.refresh(listing)

            create_comment(listing.id, ChatMessageCreate(message="Can I see it today?"), session=session, user=commenter)
            comments = list_comments(listing.id, session=session)

        self.assertEqual(len(comments), 1)
        self.assertEqual(comments[0].message, "Can I see it today?")
        self.assertEqual(comments[0].sender_public_user_id, "public-commenter")

    def test_keyword_search_falls_back_to_database_when_opensearch_is_down(self) -> None:
        with Session(self.engine) as session:
            user = User(
                role=UserRole.seller,
                name="Seller",
                user_id="fallback-seller",
                phone_e164="+15558880000",
                verified_at=datetime.utcnow(),
            )
            session.add(user)
            session.commit()
            session.refresh(user)

            session.add(make_listing(user.id, title="Toyota Camry 2020 for sale"))
            session.add(make_listing(user.id, title="Mazda CX-90 2024 for sale", make="Mazda", model="CX-90"))
            session.commit()

            with patch(
                "app.api.v1.routes.search.ensure_index",
                side_effect=OpenSearchConnectionError("opensearch", "down"),
            ):
                result = search_cars(q="Camry", lat=None, lon=None, radius_km=None, page=1, page_size=20, session=session)

        self.assertEqual(result["total"], 1)
        self.assertEqual(result["items"][0]["title"], "Toyota Camry 2020 for sale")

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
