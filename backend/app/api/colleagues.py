from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.models.user import User
from app.schemas.user import UserCreate, UserOut, ColleagueUpdate
from app.core.security import hash_password

router = APIRouter(prefix="/colleagues", tags=["colleagues"])


@router.get("", response_model=list[UserOut])
async def list_colleagues(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(User).order_by(User.full_name))
    return result.scalars().all()


@router.post("", response_model=UserOut, status_code=201)
async def invite_colleague(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("superadmin", "admin")),
):
    result = await db.execute(select(User).where(User.email == payload.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_colleague(
    user_id: str,
    payload: ColleagueUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("superadmin", "admin")),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.email and payload.email != user.email:
        existing = await db.execute(select(User).where(User.email == payload.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already in use")
        user.email = payload.email
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        user.role = payload.role
    if payload.password is not None:
        user.hashed_password = hash_password(payload.password)
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}/deactivate", response_model=UserOut)
async def deactivate_colleague(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("superadmin", "admin")),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await db.commit()
    await db.refresh(user)
    return user


@router.patch("/{user_id}/reactivate", response_model=UserOut)
async def reactivate_colleague(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles("superadmin", "admin")),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    await db.commit()
    await db.refresh(user)
    return user
