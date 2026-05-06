from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


class PresignRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    filename: str = "upload.jpg"
    content_type: str = Field(
        default="image/jpeg",
        validation_alias=AliasChoices("content_type", "contentType"),
    )

    @field_validator("filename", mode="before")
    @classmethod
    def normalize_filename(cls, value: object) -> str:
        filename = str(value or "").strip()
        return filename or "upload.jpg"

    @field_validator("content_type", mode="before")
    @classmethod
    def normalize_content_type(cls, value: object) -> str:
        content_type = str(value or "").strip().lower()
        return content_type or "image/jpeg"

class PresignResponse(BaseModel):
    upload_url: str
    storage_key: str
    public_url: str

class MediaCompleteRequest(BaseModel):
    storage_key: str
    public_url: str
    is_cover: bool = False
