from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import hashlib
import secrets
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Annotated

import bcrypt
import jwt
import httpx
from html import escape
from urllib.parse import urlparse

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, BackgroundTasks
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, BeforeValidator, EmailStr, ConfigDict
from bson import ObjectId

# ------------------------------------------------------------------ DB
mongo_url = os.environ.get('MONGO_URL', '')
db_name = os.environ.get('DB_NAME', 'klinik_db')

# Mengaktifkan toleransi TLS/SSL agar koneksi Atlas tidak terblokir
client = AsyncIOMotorClient(
    mongo_url,
    tls=True,
    tlsAllowInvalidCertificates=True,
    serverSelectionTimeoutMS=10000
)
db = client[db_name]

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------ Mongo helpers
def _to_str(v):
    if isinstance(v, ObjectId):
        return str(v)
    return v

PyObjectId = Annotated[str, BeforeValidator(_to_str)]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    @classmethod
    def from_mongo(cls, doc):
        if not doc:
            return None
        doc = dict(doc)
        if "_id" in doc:
            doc["id"] = str(doc.pop("_id"))
        return cls(**doc)

    def to_mongo(self):
        data = self.model_dump(by_alias=True, exclude_none=True)
        data.pop("id", None)
        data.pop("_id", None)
        return data


def now_utc():
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


# ------------------------------------------------------------------ Auth utils
JWT_ALGORITHM = "HS256"


def get_jwt_secret() -> str:
    return os.environ.get("JWT_SECRET", "default_secret_fallback_12345")


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, token_version: int = 0) -> str:
    payload = {"sub": user_id, "email": email, "ver": token_version,
               "exp": now_utc() + timedelta(minutes=15), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str, token_version: int = 0) -> str:
    payload = {"sub": user_id, "ver": token_version,
               "exp": now_utc() + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True,
                        samesite="none", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True,
                        samesite="none", max_age=604800, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Belum masuk / sesi tidak valid")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Tipe token tidak valid")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User tidak ditemukan")
        if payload.get("ver", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Sesi berakhir")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token kedaluwarsa")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")


# ------------------------------------------------------------------ Brute force
async def is_locked_out(ip: str, email: str) -> bool:
    identifier = f"{ip}:{email}"
    cutoff = now_utc() - timedelta(minutes=15)
    count = await db.login_attempts.count_documents({
        "identifier": identifier, "created_at": {"$gt": cutoff.isoformat()}
    })
    return count >= 5


async def record_failed_attempt(ip: str, email: str):
    await db.login_attempts.insert_one({
        "identifier": f"{ip}:{email}", "email": email, "created_at": now_utc().isoformat()
    })


async def clear_attempts(ip: str, email: str):
    await db.login_attempts.delete_many({"identifier": f"{ip}:{email}"})


# ------------------------------------------------------------------ Email
EMAIL_BASE_URL = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip().rstrip("/") or "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME") or "Klinik Bidan"


async def send_password_reset_email(to_email: str, token: str) -> bool:
    base = os.environ.get("FRONTEND_URL", "").rstrip("/")
    link = f"{base}/reset-password?token={token}"
    if not EMAIL_KEY or EMAIL_KEY.startswith("{") or not base.startswith("https://"):
        if urlparse(base).hostname in ("localhost", "127.0.0.1", "::1"):
            logger.warning("Email not configured; password reset link: %s", link)
        else:
            logger.error("Password reset email not configured (EMERGENT_EMAIL_KEY / FRONTEND_URL)")
        return False
    brand = escape(EMAIL_FROM_NAME)
    html = (
        f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif">'
        f'<p>Kami menerima permintaan untuk mengatur ulang kata sandi {brand} Anda.</p>'
        f'<p><a href="{escape(link)}">Atur ulang kata sandi</a></p>'
        f'<p>Tautan ini berlaku 1 jam dan hanya bisa dipakai sekali. Jika Anda tidak meminta ini, '
        f'abaikan email ini — kata sandi Anda tidak berubah.</p>'
        f'<p style="font-size:12px;color:#888">Dikirim oleh {brand}.</p>'
        f'</td></tr></table>'
    )
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            resp = await c.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json={"to": [to_email], "subject": f"Atur ulang kata sandi {EMAIL_FROM_NAME}",
                      "html": html, "from_name": EMAIL_FROM_NAME},
            )
            resp.raise_for_status()
            return True
    except Exception as e:
        logger.error(f"Password reset email failed: {e}")
        return False


# ------------------------------------------------------------------ Models
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str


class PatientIn(BaseModel):
    nama: str
    nik: Optional[str] = ""
    tanggal_lahir: Optional[str] = ""
    jenis_kelamin: str = "Perempuan"
    alamat: Optional[str] = ""
    telepon: Optional[str] = ""
    golongan_darah: Optional[str] = "-"
    pekerjaan: Optional[str] = ""
    nama_suami: Optional[str] = ""


class DrugIn(BaseModel):
    nama: str
    kategori: Optional[str] = "Obat"
    satuan: Optional[str] = "Tablet"
    harga: float = 0
    stok: int = 0


class PrescriptionItem(BaseModel):
    drug_id: str
    drug_name: str
    qty: int = 1
    harga: float = 0
    aturan: Optional[str] = ""


class VisitIn(BaseModel):
    patient_id: str
    tanggal: Optional[str] = ""
    keluhan: Optional[str] = ""
    diagnosa: Optional[str] = ""
    tindakan: Optional[str] = ""
    catatan: Optional[str] = ""
    biaya_konsultasi: float = 0
    biaya_tindakan: float = 0
    prescriptions: List[PrescriptionItem] = []


class PaymentIn(BaseModel):
    metode_bayar: str = "Tunai"


class PregnancyIn(BaseModel):
    patient_id: str
    hpht: str  # first day of last menstruation YYYY-MM-DD
    gravida: int = 1
    para: int = 0
    abortus: int = 0
    catatan: Optional[str] = ""


class ANCIn(BaseModel):
    pregnancy
