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
    hpht: str
    gravida: int = 1
    para: int = 0
    abortus: int = 0
    catatan: Optional[str] = ""


class ANCIn(BaseModel):
    pregnancy_id: str
    tanggal: Optional[str] = ""
    berat_badan: Optional[float] = 0
    tekanan_darah: Optional[str] = ""
    tinggi_fundus: Optional[float] = 0
    djj: Optional[str] = ""
    keluhan: Optional[str] = ""
    catatan: Optional[str] = ""
    jadwal_berikutnya: Optional[str] = ""


class DeliveryIn(BaseModel):
    pregnancy_id: str
    tanggal: Optional[str] = ""
    jenis_persalinan: str = "Normal"
    tempat: Optional[str] = "Klinik"
    penolong: Optional[str] = ""
    catatan: Optional[str] = ""
    bayi_nama: Optional[str] = ""
    bayi_jenis_kelamin: Optional[str] = "Laki-laki"
    bayi_berat: Optional[float] = 0
    bayi_panjang: Optional[float] = 0
    apgar: Optional[str] = ""


# ------------------------------------------------------------------ App
app = FastAPI(title="SIM Klinik Bidan")
api = APIRouter(prefix="/api")


def clean(doc):
    if not doc:
        return doc
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    doc.pop("password_hash", None)
    return doc


# ---------------------------- Auth endpoints
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    doc = {"email": email, "password_hash": hash_password(body.password), "name": body.name,
           "role": "staff", "token_version": 0, "created_at": now_utc().isoformat()}
    res = await db.users.insert_one(doc)
    uid = str(res.inserted_id)
    set_auth_cookies(response, create_access_token(uid, email, 0), create_refresh_token(uid, 0))
    return {"id": uid, "email": email, "name": body.name, "role": "staff"}


@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.lower()
    ip = request.client.host if request.client else "unknown"
    if await is_locked_out(ip, email):
        raise HTTPException(status_code=429, detail="Terlalu banyak percobaan. Coba lagi dalam 15 menit.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        await record_failed_attempt(ip, email)
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")
    await clear_attempts(ip, email)
    uid = str(user["_id"])
    ver = user.get("token_version", 0)
    set_auth_cookies(response, create_access_token(uid, email, ver), create_refresh_token(uid, ver))
    return clean(user)


@api.post("/auth/logout")
async def logout(response: Response, user=Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Berhasil keluar"}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Tidak ada refresh token")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Tipe token salah")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user or payload.get("ver", 0) != user.get("token_version", 0):
            raise HTTPException(status_code=401, detail="Sesi berakhir")
        uid = str(user["_id"])
        ver = user.get("token_version", 0)
        set_auth_cookies(response, create_access_token(uid, user["email"], ver), create_refresh_token(uid, ver))
        return {"message": "ok"}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")


GENERIC_RESET = {"message": "Jika email terdaftar, tautan atur ulang telah dikirim."}


@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotIn, background_tasks: BackgroundTasks):
    email = body.email.lower()
    await db.password_reset_requests.insert_one({"email": email, "created_at": now_utc().isoformat()})
    cutoff = now_utc() - timedelta(minutes=15)
    recent = await db.password_reset_requests.count_documents({"email": email, "created_at": {"$gt": cutoff.isoformat()}})
    if recent > 5:
        return GENERIC_RESET
    user = await db.users.find_one({"email": email})
    if not user:
        return GENERIC_RESET
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    await db.password_reset_tokens.insert_one({
        "token_hash": token_hash, "user_id": str(user["_id"]), "email": email,
        "expires_at": now_utc() + timedelta(hours=1), "used": False,
    })
    background_tasks.add_task(send_password_reset_email, user["email"], token)
    return GENERIC_RESET


@api.post("/auth/reset-password")
async def reset_password(body: ResetIn):
    h = hashlib.sha256(body.token.encode()).hexdigest()
    doc = await db.password_reset_tokens.find_one_and_update(
        {"token_hash": h, "used": False, "expires_at": {"$gt": now_utc()}},
        {"$set": {"used": True}},
    )
    if not doc:
        raise HTTPException(status_code=400, detail="Tautan tidak valid atau kedaluwarsa")
    await db.users.update_one(
        {"_id": ObjectId(doc["user_id"])},
        {"$set": {"password_hash": hash_password(body.password)}, "$inc": {"token_version": 1}},
    )
    await db.password_reset_tokens.delete_many({"user_id": doc["user_id"], "used": False})
    await db.login_attempts.delete_many({"email": doc["email"]})
    return {"message": "Kata sandi berhasil diperbarui"}


# ---------------------------- Patients
async def next_no_rm():
    count = await db.patients.count_documents({})
    return f"RM-{count + 1:05d}"


@api.get("/patients")
async def list_patients(q: Optional[str] = None, user=Depends(get_current_user)):
    query = {}
    if q:
        query = {"$or": [{"nama": {"$regex": q, "$options": "i"}},
                          {"no_rm": {"$regex": q, "$options": "i"}},
                          {"nik": {"$regex": q, "$options": "i"}}]}
    docs = await db.patients.find(query).sort("created_at", -1).to_list(1000)
    return [clean(d) for d in docs]


@api.post("/patients")
async def create_patient(body: PatientIn, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc["no_rm"] = await next_no_rm()
    doc["created_at"] = now_utc().isoformat()
    res = await db.patients.insert_one(doc)
    return clean(await db.patients.find_one({"_id": res.inserted_id}))


@api.get("/patients/{pid}")
async def get_patient(pid: str, user=Depends(get_current_user)):
    doc = await db.patients.find_one({"_id": ObjectId(pid)})
    if not doc:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")
    patient = clean(doc)
    visits = await db.visits.find({"patient_id": pid}).sort("created_at", -1).to_list(500)
    pregnancies = await db.pregnancies.find({"patient_id": pid}).sort("created_at", -1).to_list(100)
    return {"patient": patient, "visits": [clean(v) for v in visits],
            "pregnancies": [clean(p) for p in pregnancies]}


@api.put("/patients/{pid}")
async def update_patient(pid: str, body: PatientIn, user=Depends(get_current_user)):
    await db.patients.update_one({"_id": ObjectId(pid)}, {"$set": body.model_dump()})
    return clean(await db.patients.find_one({"_id": ObjectId(pid)}))


@api.delete("/patients/{pid}")
async def delete_patient(pid: str, user=Depends(get_current_user)):
    await db.patients.delete_one({"_id": ObjectId(pid)})
    return {"message": "Pasien dihapus"}


# ---------------------------- Drugs
@api.get("/drugs")
async def list_drugs(q: Optional[str] = None, user=Depends(get_current_user)):
    query = {}
    if q:
        query = {"nama": {"$regex": q, "$options": "i"}}
    docs = await db.drugs.find(query).sort("nama", 1).to_list(1000)
    return [clean(d) for d in docs]


@api.post("/drugs")
async def create_drug(body: DrugIn, user=Depends(get_current_user)):
    doc = body.model_dump()
    doc["created_at"] = now_utc().isoformat()
    res = await db.drugs.insert_one(doc)
    return clean(await db.drugs.find_one({"_id": res.inserted_id}))


@api.put("/drugs/{did}")
async def update_drug(did: str, body: DrugIn, user=Depends(get_current_user)):
    await db.drugs.update_one({"_id": ObjectId(did)}, {"$set": body.model_dump()})
    return clean(await db.drugs.find_one({"_id": ObjectId(did)}))


@api.delete("/drugs/{did}")
async def delete_drug(did: str, user=Depends(get_current_user)):
    await db.drugs.delete_one({"_id": ObjectId(did)})
    return {"message": "Obat dihapus"}


# ---------------------------- Visits
@api.get("/visits")
async def list_visits(user=Depends(get_current_user)):
    docs = await db.visits.find({}).sort("created_at", -1).to_list(1000)
    return [clean(d) for d in docs]


@api.post("/visits")
async def create_visit(body: VisitIn, user=Depends(get_current_user)):
    patient = await db.patients.find_one({"_id": ObjectId(body.patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")
    obat_total = sum(p.qty * p.harga for p in body.prescriptions)
    total = body.biaya_konsultasi + body.biaya_tindakan + obat_total
    doc = body.model_dump()
    doc["patient_name"] = patient["nama"]
    doc["no_rm"] = patient.get("no_rm", "")
    doc["tanggal"] = body.tanggal or now_utc().date().isoformat()
    doc["obat_total"] = obat_total
    doc["total"] = total
    doc["status_bayar"] = "Belum Bayar"
    doc["created_at"] = now_utc().isoformat()
    res = await db.visits.insert_one(doc)
    visit = await db.visits.find_one({"_id": res.inserted_id})

    for p in body.prescriptions:
        try:
            await db.drugs.update_one({"_id": ObjectId(p.drug_id)}, {"$inc": {"stok": -p.qty}})
        except Exception:
            pass

    items = [{"nama": "Biaya Konsultasi", "qty": 1, "harga": body.biaya_konsultasi, "subtotal": body.biaya_konsultasi}] if body.biaya_konsultasi else []
    if body.biaya_tindakan:
        items.append({"nama": body.tindakan or "Tindakan", "qty": 1, "harga": body.biaya_tindakan, "subtotal": body.biaya_tindakan})
    for p in body.prescriptions:
        items.append({"nama": p.drug_name, "qty": p.qty, "harga": p.harga, "subtotal": p.qty * p.harga})
    inv = {"visit_id": str(res.inserted_id), "patient_id": body.patient_id,
           "patient_name": patient["nama"], "no_rm": patient.get("no_rm", ""),
           "tanggal": doc["tanggal"], "items": items, "total": total,
           "status": "Belum Bayar", "metode_bayar": "", "created_at": now_utc().isoformat()}
    await db.invoices.insert_one(inv)
    return clean(visit)


@api.get("/visits/{vid}")
async def get_visit(vid: str, user=Depends(get_current_user)):
    doc = await db.visits.find_one({"_id": ObjectId(vid)})
    if not doc:
        raise HTTPException(status_code=404, detail="Kunjungan tidak ditemukan")
    return clean(doc)


@api.delete("/visits/{vid}")
async def delete_visit(vid: str, user=Depends(get_current_user)):
    await db.visits.delete_one({"_id": ObjectId(vid)})
    await db.invoices.delete_many({"visit_id": vid})
    return {"message": "Kunjungan dihapus"}


# ---------------------------- Invoices / Billing
@api.get("/invoices")
async def list_invoices(status: Optional[str] = None, user=Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    docs = await db.invoices.find(query).sort("created_at", -1).to_list(1000)
    return [clean(d) for d in docs]


@api.get("/invoices/{iid}")
async def get_invoice(iid: str, user=Depends(get_current_user)):
    doc = await db.invoices.find_one({"_id": ObjectId(iid)})
    if not doc:
        raise HTTPException(status_code=404, detail="Tagihan tidak ditemukan")
    return clean(doc)


@api.post("/invoices/{iid}/pay")
async def pay_invoice(iid: str, body: PaymentIn, user=Depends(get_current_user)):
    inv = await db.invoices.find_one({"_id": ObjectId(iid)})
    if not inv:
        raise HTTPException(status_code=404, detail="Tagihan tidak ditemukan")
    await db.invoices.update_one({"_id": ObjectId(iid)},
                                 {"$set": {"status": "Lunas", "metode_bayar": body.metode_bayar,
                                           "tanggal_bayar": now_utc().isoformat()}})
    await db.visits.update_one({"_id": ObjectId(inv["visit_id"])}, {"$set": {"status_bayar": "Lunas"}})
    return clean(await db.invoices.find_one({"_id": ObjectId(iid)}))


# ---------------------------- Maternity (Kebidanan)
def calc_hpl(hpht_str: str) -> str:
    try:
        d = date.fromisoformat(hpht_str)
        year = d.year + 1
        month = d.month - 3
        if month <= 0:
            month += 12
            year -= 1
        day = d.day + 7
        import calendar
        last = calendar.monthrange(year, month)[1]
        if day > last:
            day -= last
            month += 1
            if month > 12:
                month = 1
                year += 1
        return date(year, month, day).isoformat()
    except Exception:
        return ""


def calc_usia_kehamilan(hpht_str: str) -> int:
    try:
        d = date.fromisoformat(hpht_str)
        days = (date.today() - d).days
        return max(0, days // 7)
    except Exception:
        return 0


@api.get("/pregnancies")
async def list_pregnancies(status: Optional[str] = None, user=Depends(get_current_user)):
    query = {}
    if status:
        query["status"] = status
    docs = await db.pregnancies.find(query).sort("created_at", -1).to_list(1000)
    out = []
    for d in docs:
        c = clean(d)
        c["usia_kehamilan"] = calc_usia_kehamilan(d.get("hpht", ""))
        out.append(c)
    return out


@api.post("/pregnancies")
async def create_pregnancy(body: PregnancyIn, user=Depends(get_current_user)):
    patient = await db.patients.find_one({"_id": ObjectId(body.patient_id)})
    if not patient:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")
    doc = body.model_dump()
    doc["patient_name"] = patient["nama"]
    doc["no_rm"] = patient.get("no_rm", "")
    doc["hpl"] = calc_hpl(body.hpht)
    doc["status"] = "Aktif"
    doc["created_at"] = now_utc().isoformat()
    res = await db.pregnancies.insert_one(doc)
    c = clean(await db.pregnancies.find_one({"_id": res.inserted_id}))
    c["usia_kehamilan"] = calc_usia_kehamilan(body.hpht)
    return c


@api.get("/pregnancies/{pid}")
async def get_pregnancy(pid: str, user=Depends(get_current_user)):
    doc = await db.pregnancies.find_one({"_id": ObjectId(pid)})
    if not doc:
        raise HTTPException(status_code=404, detail="Data kehamilan tidak ditemukan")
    c = clean(doc)
    c["usia_kehamilan"] = calc_usia_kehamilan(doc.get("hpht", ""))
    anc = await db.anc_visits.find({"pregnancy_id": pid}).sort("created_at", -1).to_list(500)
    deliveries = await db.deliveries.find({"pregnancy_id": pid}).sort("created_at", -1).to_list(100)
    return {"pregnancy": c, "anc": [clean(a) for a in anc], "deliveries": [clean(d) for d in deliveries]}


@api.post("/pregnancies/{pid}/complete")
async def complete_pregnancy(pid: str, user=Depends(get_current_user)):
    await db.pregnancies.update_one({"_id": ObjectId(pid)}, {"$set": {"status": "Selesai"}})
    return {"message": "Kehamilan ditandai selesai"}


@api.post("/anc")
async def create_anc(body: ANCIn, user=Depends(get_current_user)):
    preg = await db.pregnancies.find_one({"_id": ObjectId(body.pregnancy_id)})
    if not preg:
        raise HTTPException(status_code=404, detail="Data kehamilan tidak ditemukan")
    doc = body.model_dump()
    doc["patient_name"] = preg["patient_name"]
    doc["tanggal"] = body.tanggal or now_utc().date().isoformat()
    doc["usia_kehamilan"] = calc_usia_kehamilan(preg.get("hpht", ""))
    doc["created_at"] = now_utc().isoformat()
    res = await db.anc_visits.insert_one(doc)
    return clean(await db.anc_visits.find_one({"_id": res.inserted_id}))


@api.post("/deliveries")
async def create_delivery(body: DeliveryIn, user=Depends(get_current_user)):
    preg = await db.pregnancies.find_one({"_id": ObjectId(body.pregnancy_id)})
    if not preg:
        raise HTTPException(status_code=404, detail="Data kehamilan tidak ditemukan")
    doc = body.model_dump()
    doc["patient_name"] = preg["patient_name"]
    doc["no_rm"] = preg.get("no_rm", "")
    doc["tanggal"] = body.tanggal or now_utc().date().isoformat()
    doc["created_at"] = now_utc().isoformat()
    res = await db.deliveries.insert_one(doc)
    await db.pregnancies.update_one({"_id": ObjectId(body.pregnancy_id)}, {"$set": {"status": "Selesai"}})
    return clean(await db.deliveries.find_one({"_id": res.inserted_id}))


@api.get("/deliveries")
async def list_deliveries(user=Depends(get_current_user)):
    docs = await db.deliveries.find({}).sort("created_at", -1).to_list(1000)
    return [clean(d) for d in docs]


# ---------------------------- Dashboard
@api.get("/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    today = now_utc().date().isoformat()
    month_start = now_utc().replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()

    total_patients = await db.patients.count_documents({})
    total_drugs = await db.drugs.count_documents({})
    active_pregnancies = await db.pregnancies.count_documents({"status": "Aktif"})
    visits_today = await db.visits.count_documents({"tanggal": today})

    paid = await db.invoices.find({"status": "Lunas", "created_at": {"$gt": month_start}}).to_list(5000)
    revenue_month = sum(i.get("total", 0) for i in paid)

    unpaid = await db.invoices.count_documents({"status": "Belum Bayar"})
    unpaid_total_docs = await db.invoices.find({"status": "Belum Bayar"}).to_list(5000)
    unpaid_total = sum(i.get("total", 0) for i in unpaid_total_docs)

    all_visits = await db.visits.find({}).to_list(10000)
    buckets = {}
    for v in all_visits:
        t = v.get("tanggal", "")[:7]
        if t:
            buckets[t] = buckets.get(t, 0) + 1
    months = sorted(buckets.keys())[-6:]
    chart = [{"bulan": m, "kunjungan": buckets[m]} for m in months]

    recent = await db.visits.find({}).sort("created_at", -1).to_list(6)

    return {
        "total_patients": total_patients,
        "total_drugs": total_drugs,
        "active_pregnancies": active_pregnancies,
        "visits_today": visits_today,
        "revenue_month": revenue_month,
        "unpaid_count": unpaid,
        "unpaid_total": unpaid_total,
        "chart": chart,
        "recent_visits": [clean(r) for r in recent],
    }


# ------------------------------------------------------------------ Seed
SEED_DRUGS = [
    ("Paracetamol 500mg", "Analgesik", "Tablet", 500, 500),
    ("Amoxicillin 500mg", "Antibiotik", "Kapsul", 1000, 300),
    ("Asam Mefenamat 500mg", "Analgesik", "Tablet", 800, 400),
    ("Antasida Doen", "Lambung", "Tablet", 400, 300),
    ("Vitamin B Complex", "Vitamin", "Tablet", 600, 500),
    ("Tablet Tambah Darah (Fe)", "Suplemen", "Tablet", 500, 800),
    ("Kalsium Laktat", "Suplemen", "Tablet", 700, 400),
    ("Asam Folat 400mcg", "Suplemen", "Tablet", 500, 600),
    ("Oxytocin Injeksi 10 IU", "Injeksi", "Ampul", 15000, 50),
    ("Lidocaine 2% Injeksi", "Injeksi", "Ampul", 8000, 40),
    ("Vitamin C 50mg", "Vitamin", "Tablet", 500, 500),
    ("CTM 4mg", "Antihistamin", "Tablet", 300, 400),
    ("Dexamethasone 0.5mg", "Kortikosteroid", "Tablet", 500, 300),
    ("Ranitidine 150mg", "Lambung", "Tablet", 700, 300),
    ("Domperidone 10mg", "Antiemetik", "Tablet", 1000, 200),
    ("Oralit Sachet", "Rehidrasi", "Sachet", 2000, 150),
    ("Betadine 60ml", "Antiseptik", "Botol", 18000, 30),
    ("Infus Ringer Laktat 500ml", "Cairan", "Botol", 12000, 40),
    ("Spuit 3cc", "Alkes", "Pcs", 2000, 200),
    ("Kasa Steril", "Alkes", "Pcs", 3000, 150),
    ("Salbutamol 2mg", "Bronkodilator", "Tablet", 600, 100),
    ("Metronidazole 500mg", "Antibiotik", "Tablet", 900, 150),
    ("Vitamin K Injeksi", "Injeksi", "Ampul", 10000, 40),
    ("Imunisasi BCG", "Vaksin", "Dosis", 25000, 30),
]


async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({"email": admin_email, "password_hash": hash_password(admin_password),
                                   "name": "Bidan Admin", "role": "admin", "token_version": 0,
                                   "created_at": now_utc().isoformat()})
        logger.info("Admin seeded")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})


async def seed_drugs():
    if await db.drugs.count_documents({}) == 0:
        docs = [{"nama": n, "kategori": k, "satuan": s, "harga": h, "stok": st,
                 "created_at": now_utc().isoformat()} for (n, k, s, h, st) in SEED_DRUGS]
        await db.drugs.insert_many(docs)
        logger.info("Drugs seeded")


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.password_reset_tokens.create_index("token_hash", unique=True)
    await db.login_attempts.create_index("email")
    await db.login_attempts.create_index("identifier")
    await db.password_reset_requests.create_index("email")
    await db.password_reset_requests.create_index("created_at", expireAfterSeconds=900)
    await seed_admin()
    await seed_drugs()


@api.get("/")
async def root():
    return {"message": "SIM Klinik Bidan API"}


app.include_router(api)

frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
origins = [
    frontend_url,
    "http://localhost:3000",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
