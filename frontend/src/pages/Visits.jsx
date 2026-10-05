import { useEffect, useState } from "react";
import { Plus, Trash2, Stethoscope, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import { rupiah, tanggalPendek } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Visits() {
  const [visits, setVisits] = useState([]);
  const [patients, setPatients] = useState([]);
  const [drugs, setDrugs] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [patientId, setPatientId] = useState("");
  const [keluhan, setKeluhan] = useState("");
  const [diagnosa, setDiagnosa] = useState("");
  const [tindakan, setTindakan] = useState("");
  const [catatan, setCatatan] = useState("");
  const [biayaKonsultasi, setBiayaKonsultasi] = useState(25000);
  const [biayaTindakan, setBiayaTindakan] = useState(0);
  const [rx, setRx] = useState([]);
  const [drugPick, setDrugPick] = useState("");

  const load = async () => {
    const [v, p, d] = await Promise.all([
      api.get("/visits"),
      api.get("/patients"),
      api.get("/drugs"),
    ]);
    setVisits(v.data);
    setPatients(p.data);
    setDrugs(d.data);
  };

  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setPatientId("");
    setKeluhan("");
    setDiagnosa("");
    setTindakan("");
    setCatatan("");
    setBiayaKonsultasi(25000);
    setBiayaTindakan(0);
    setRx([]);
    setDrugPick("");
  };

  const addDrug = (did) => {
    const d = drugs.find((x) => x.id === did);
    if (!d) return;
    if (rx.find((r) => r.drug_id === did)) {
      toast.info("Obat sudah ditambahkan");
      return;
    }
    setRx((prev) => [...prev, { drug_id: d.id, drug_name: d.nama, qty: 1, harga: d.harga, aturan: "" }]);
    setDrugPick("");
  };

  const updateRx = (id, key, val) =>
    setRx((prev) => prev.map((r) => (r.drug_id === id ? { ...r, [key]: val } : r)));
  const removeRx = (id) => setRx((prev) => prev.filter((r) => r.drug_id !== id));

  const obatTotal = rx.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.harga) || 0), 0);
  const total = (Number(biayaKonsultasi) || 0) + (Number(biayaTindakan) || 0) + obatTotal;

  const save = async () => {
    if (!patientId) return toast.error("Pilih pasien terlebih dahulu");
    setSaving(true);
    try {
      await api.post("/visits", {
        patient_id: patientId,
        keluhan,
        diagnosa,
        tindakan,
        catatan,
        biaya_konsultasi: Number(biayaKonsultasi) || 0,
        biaya_tindakan: Number(biayaTindakan) || 0,
        prescriptions: rx.map((r) => ({
          drug_id: r.drug_id,
          drug_name: r.drug_name,
          qty: Number(r.qty) || 1,
          harga: Number(r.harga) || 0,
          aturan: r.aturan,
        })),
      });
      toast.success("Kunjungan & tagihan tersimpan");
      setOpen(false);
      reset();
      load();
    } catch (e) {
      toast.error("Gagal menyimpan kunjungan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-head text-3xl font-semibold text-stone-900">Kunjungan & Resep</h1>
          <p className="text-stone-500 mt-1">Catat pemeriksaan, diagnosa, dan resep obat</p>
        </div>
        <Button
          onClick={() => {
            reset();
            setOpen(true);
          }}
          className="bg-primary hover:bg-[#47644D]"
          data-testid="add-visit-button"
        >
          <Plus className="h-4 w-4 mr-2" /> Kunjungan Baru
        </Button>
      </div>

      <Card className="border-stone-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-stone-50">
              <TableHead>Tanggal</TableHead>
              <TableHead>Pasien</TableHead>
              <TableHead>Diagnosa</TableHead>
              <TableHead>Obat</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-stone-400 py-10">
                  Belum ada kunjungan tercatat.
                </TableCell>
              </TableRow>
            ) : (
              visits.map((v) => (
                <TableRow key={v.id} data-testid={`visit-row-${v.id}`} className="hover:bg-stone-50">
                  <TableCell className="text-stone-600">{tanggalPendek(v.tanggal)}</TableCell>
                  <TableCell className="font-medium text-stone-800">
                    {v.patient_name}
                    <span className="block text-xs text-stone-400 font-mono">{v.no_rm}</span>
                  </TableCell>
                  <TableCell className="text-stone-600">{v.diagnosa || "-"}</TableCell>
                  <TableCell className="text-stone-600">{v.prescriptions?.length || 0} item</TableCell>
                  <TableCell className="text-right font-medium text-stone-800">{rupiah(v.total)}</TableCell>
                  <TableCell className="text-right">
                    <Badge className={v.status_bayar === "Lunas" ? "bg-primary" : "bg-amber-100 text-amber-700"}>
                      {v.status_bayar}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-head flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-primary" /> Kunjungan Baru
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label>Pasien *</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger className="mt-1.5" data-testid="visit-patient-select">
                  <SelectValue placeholder="Pilih pasien" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nama} ({p.no_rm})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Keluhan</Label>
                <Textarea value={keluhan} onChange={(e) => setKeluhan(e.target.value)} className="mt-1.5" rows={2} data-testid="visit-keluhan" />
              </div>
              <div>
                <Label>Diagnosa</Label>
                <Textarea value={diagnosa} onChange={(e) => setDiagnosa(e.target.value)} className="mt-1.5" rows={2} data-testid="visit-diagnosa" />
              </div>
            </div>

            <div>
              <Label>Tindakan</Label>
              <Input value={tindakan} onChange={(e) => setTindakan(e.target.value)} className="mt-1.5" placeholder="cth: Pemeriksaan ANC, Suntik, dll" />
            </div>

            {/* Resep */}
            <div className="rounded-lg border border-stone-200 p-4 bg-stone-50/50">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-semibold">Resep Obat</Label>
                <div className="w-56">
                  <Select value={drugPick} onValueChange={addDrug}>
                    <SelectTrigger className="h-9 bg-white" data-testid="visit-add-drug">
                      <SelectValue placeholder="+ Tambah obat" />
                    </SelectTrigger>
                    <SelectContent>
                      {drugs.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.nama} — {rupiah(d.harga)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {rx.length === 0 ? (
                <p className="text-sm text-stone-400 py-2">Belum ada obat dipilih</p>
              ) : (
                <div className="space-y-2">
                  {rx.map((r) => (
                    <div key={r.drug_id} className="flex items-center gap-2 bg-white rounded-md border border-stone-200 p-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-800 truncate">{r.drug_name}</p>
                        <p className="text-xs text-stone-500">{rupiah(r.harga)} / unit</p>
                      </div>
                      <Input
                        type="number"
                        min={1}
                        value={r.qty}
                        onChange={(e) => updateRx(r.drug_id, "qty", e.target.value)}
                        className="w-16 h-8"
                        data-testid={`rx-qty-${r.drug_id}`}
                      />
                      <span className="text-sm font-medium text-stone-700 w-24 text-right">
                        {rupiah((Number(r.qty) || 0) * r.harga)}
                      </span>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeRx(r.drug_id)}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Biaya Konsultasi (Rp)</Label>
                <Input type="number" value={biayaKonsultasi} onChange={(e) => setBiayaKonsultasi(e.target.value)} className="mt-1.5" data-testid="visit-biaya-konsultasi" />
              </div>
              <div>
                <Label>Biaya Tindakan (Rp)</Label>
                <Input type="number" value={biayaTindakan} onChange={(e) => setBiayaTindakan(e.target.value)} className="mt-1.5" data-testid="visit-biaya-tindakan" />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-accent px-4 py-3">
              <span className="text-sm font-medium text-primary">Total Tagihan</span>
              <span className="font-head text-xl font-semibold text-primary" data-testid="visit-total">
                {rupiah(total)}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving} className="bg-primary hover:bg-[#47644D]" data-testid="save-visit-button">
              Simpan Kunjungan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
