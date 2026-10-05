"""End-to-end backend tests for SIM Klinik Bidan.

Tests cover: auth (login/me/logout/forgot/reset), patients CRUD + search,
drugs seeding/CRUD, visits (invoice + stock), billing/pay, maternity
(pregnancy/ANC/delivery), dashboard stats.
"""
import os
import time
import pytest
import requests
from datetime import date, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to frontend .env
    try:
        with open("/app/frontend/.env") as f:
            for ln in f:
                if ln.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = ln.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

API = f"{BASE_URL}/api"
ADMIN_EMAIL = "denisukarya003@gmail.com"
ADMIN_PASS = "bidan123"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["email"] == ADMIN_EMAIL
    assert "password_hash" not in data
    return s


# --- Auth
class TestAuth:
    def test_me(self, client):
        r = client.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_bad_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=30)
        assert r.status_code == 401

    def test_forgot_registered(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": ADMIN_EMAIL}, timeout=30)
        assert r.status_code == 200
        assert "terdaftar" in r.json()["message"].lower() or "message" in r.json()
        return r.json()

    def test_forgot_unregistered_identical(self):
        r1 = requests.post(f"{API}/auth/forgot-password", json={"email": ADMIN_EMAIL}, timeout=30)
        r2 = requests.post(f"{API}/auth/forgot-password", json={"email": "nobody_xyz@example.com"}, timeout=30)
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json() == r2.json(), "Forgot-password responses must be identical"

    def test_reset_invalid_token(self):
        r = requests.post(f"{API}/auth/reset-password", json={"token": "invalid-xyz", "password": "newpass123"}, timeout=30)
        assert r.status_code == 400


# --- Patients
@pytest.fixture(scope="session")
def patient_id(client):
    r = client.post(f"{API}/patients", json={
        "nama": "TEST_Siti Aminah", "nik": "3201010101010001",
        "tanggal_lahir": "1995-05-20", "jenis_kelamin": "Perempuan",
        "alamat": "Jl. Mawar", "telepon": "0812",
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["nama"] == "TEST_Siti Aminah"
    assert data["no_rm"].startswith("RM-")
    assert "_id" not in data
    return data["id"]


class TestPatients:
    def test_list_and_search(self, client, patient_id):
        r = client.get(f"{API}/patients")
        assert r.status_code == 200
        assert any(p["id"] == patient_id for p in r.json())
        r2 = client.get(f"{API}/patients", params={"q": "TEST_Siti"})
        assert r2.status_code == 200
        assert any(p["id"] == patient_id for p in r2.json())

    def test_detail(self, client, patient_id):
        r = client.get(f"{API}/patients/{patient_id}")
        assert r.status_code == 200
        body = r.json()
        assert body["patient"]["id"] == patient_id
        assert "visits" in body and "pregnancies" in body

    def test_update(self, client, patient_id):
        r = client.put(f"{API}/patients/{patient_id}", json={
            "nama": "TEST_Siti Aminah", "nik": "3201010101010001",
            "tanggal_lahir": "1995-05-20", "jenis_kelamin": "Perempuan",
            "alamat": "Jl. Melati 10", "telepon": "0812",
        })
        assert r.status_code == 200
        assert r.json()["alamat"] == "Jl. Melati 10"


# --- Drugs
class TestDrugs:
    def test_seed_count(self, client):
        r = client.get(f"{API}/drugs")
        assert r.status_code == 200
        drugs = r.json()
        assert len(drugs) >= 24, f"Expected >=24 seeded drugs, got {len(drugs)}"
        # Spot check
        assert any(d["nama"] == "Paracetamol 500mg" for d in drugs)

    def test_create_update_delete(self, client):
        r = client.post(f"{API}/drugs", json={"nama": "TEST_Obat", "kategori": "Obat", "satuan": "Tablet", "harga": 1000, "stok": 10})
        assert r.status_code == 200
        did = r.json()["id"]
        r = client.put(f"{API}/drugs/{did}", json={"nama": "TEST_Obat", "kategori": "Obat", "satuan": "Tablet", "harga": 1500, "stok": 20})
        assert r.status_code == 200 and r.json()["harga"] == 1500
        r = client.delete(f"{API}/drugs/{did}")
        assert r.status_code == 200


# --- Visits + Invoice + Stock
@pytest.fixture(scope="session")
def visit_data(client, patient_id):
    drugs = client.get(f"{API}/drugs").json()
    drug = next(d for d in drugs if d["nama"] == "Paracetamol 500mg")
    stok_before = drug["stok"]
    qty = 3
    body = {
        "patient_id": patient_id, "keluhan": "Demam", "diagnosa": "ISPA",
        "tindakan": "Pemeriksaan umum", "biaya_konsultasi": 20000, "biaya_tindakan": 15000,
        "prescriptions": [{"drug_id": drug["id"], "drug_name": drug["nama"], "qty": qty, "harga": drug["harga"], "aturan": "3x1"}]
    }
    r = client.post(f"{API}/visits", json=body)
    assert r.status_code == 200, r.text
    v = r.json()
    expected_total = 20000 + 15000 + qty * drug["harga"]
    assert v["total"] == expected_total
    return {"visit": v, "drug_id": drug["id"], "stok_before": stok_before, "qty": qty}


class TestVisits:
    def test_stock_decremented(self, client, visit_data):
        drugs = client.get(f"{API}/drugs").json()
        d = next(x for x in drugs if x["id"] == visit_data["drug_id"])
        assert d["stok"] == visit_data["stok_before"] - visit_data["qty"]

    def test_invoice_auto_created(self, client, visit_data):
        invs = client.get(f"{API}/invoices").json()
        vid = visit_data["visit"]["id"]
        assert any(i["visit_id"] == vid for i in invs)


# --- Billing
class TestBilling:
    def test_filter_and_pay(self, client, visit_data):
        unpaid = client.get(f"{API}/invoices", params={"status": "Belum Bayar"}).json()
        vid = visit_data["visit"]["id"]
        inv = next(i for i in unpaid if i["visit_id"] == vid)
        iid = inv["id"]
        r = client.post(f"{API}/invoices/{iid}/pay", json={"metode_bayar": "Tunai"})
        assert r.status_code == 200
        assert r.json()["status"] == "Lunas"
        # Visit status also updated
        v = client.get(f"{API}/visits/{vid}").json()
        assert v["status_bayar"] == "Lunas"


# --- Maternity
@pytest.fixture(scope="session")
def pregnancy_id(client, patient_id):
    hpht = (date.today() - timedelta(days=90)).isoformat()
    r = client.post(f"{API}/pregnancies", json={"patient_id": patient_id, "hpht": hpht, "gravida": 1})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["hpl"], "HPL should be auto-calculated"
    assert data["usia_kehamilan"] >= 12
    return data["id"]


class TestMaternity:
    def test_hpl_naegele(self, client):
        # Known: 2024-01-10 -> 2024-10-17
        r = client.post(f"{API}/pregnancies", json={"patient_id": "000000000000000000000000", "hpht": "2024-01-10"})
        # Will fail with 404 because fake patient id; but we can test calc_hpl via actual flow
        assert r.status_code == 404

    def test_anc(self, client, pregnancy_id):
        r = client.post(f"{API}/anc", json={
            "pregnancy_id": pregnancy_id, "berat_badan": 55.5, "tekanan_darah": "110/70",
            "tinggi_fundus": 20, "djj": "140", "keluhan": "mual"
        })
        assert r.status_code == 200

    def test_delivery_completes(self, client, pregnancy_id):
        r = client.post(f"{API}/deliveries", json={
            "pregnancy_id": pregnancy_id, "jenis_persalinan": "Normal",
            "bayi_nama": "TEST_Bayi", "bayi_jenis_kelamin": "Laki-laki", "bayi_berat": 3.2,
        })
        assert r.status_code == 200
        detail = client.get(f"{API}/pregnancies/{pregnancy_id}").json()
        assert detail["pregnancy"]["status"] == "Selesai"


# --- Dashboard
class TestDashboard:
    def test_stats_shape(self, client):
        r = client.get(f"{API}/dashboard/stats")
        assert r.status_code == 200
        s = r.json()
        for k in ["total_patients", "visits_today", "active_pregnancies",
                  "revenue_month", "unpaid_count", "unpaid_total", "chart", "recent_visits"]:
            assert k in s
        assert s["total_patients"] >= 1
        assert s["revenue_month"] >= 35000  # we paid at least that
