import os
from logging.config import fileConfig

from alembic import context
from sqlmodel import SQLModel, create_engine

# import models so metadata is registered
from app.models.user import User  # noqa
from app.models.car import CarListing, CarMedia  # noqa
from app.models.lead import Lead  # noqa

config = context.config
fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata

def run_migrations_online():
    database_url = os.getenv("DATABASE_URL") or config.get_main_option("sqlalchemy.url")
    if not database_url or database_url.startswith("driver://"):
        raise RuntimeError("Set DATABASE_URL before running alembic migrations.")

    connectable = create_engine(database_url, pool_pre_ping=True)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()

run_migrations_online()
