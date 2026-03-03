from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.api.v1.routes.auth import router as auth_router
from app.api.v1.routes.me import router as me_router
from app.api.v1.routes.cars import router as cars_router
from app.api.v1.routes.admin import router as admin_router
from app.api.v1.routes.public import router as public_router
from app.api.v1.routes.dev import router as dev_router
from app.api.v1.routes.search import router as search_router
from app.api.v1.routes.media import router as media_router

app = FastAPI(title="GARAJ API", version="0.1.0")

app.include_router(auth_router, prefix="/v1")
app.include_router(me_router, prefix="/v1")
app.include_router(cars_router, prefix="/v1")
app.include_router(admin_router, prefix="/v1")
app.include_router(public_router, prefix="/v1")
app.include_router(dev_router, prefix="/v1")
app.include_router(search_router, prefix="/v1")
app.include_router(media_router, prefix="/v1")


ui_dir = Path(__file__).resolve().parent / "ui"
if ui_dir.exists():
    app.mount(
        "/ui",
        StaticFiles(directory=ui_dir, html=True),
        name="ui",
    )

@app.get("/health")
def health():
    return {"ok": True}
