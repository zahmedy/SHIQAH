from pydantic import BaseModel

class OTPRequest(BaseModel):
    phone_e164: str

class OTPVerify(BaseModel):
    phone_e164: str
    code: str
    name: str | None = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
