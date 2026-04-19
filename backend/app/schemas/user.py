from pydantic import BaseModel, EmailStr

from app.models.user import Role


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: Role = Role.operator


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: Role
    is_active: bool

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    password: str | None = None


class ColleagueUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    role: Role | None = None
    password: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
