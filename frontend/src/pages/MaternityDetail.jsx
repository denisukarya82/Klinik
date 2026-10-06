import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Baby, Activity, CalendarHeart } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import { tanggalID, tanggalPendek } from "@/lib/format";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function MaternityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [ancOpen, setAncOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initialAnc = {
    tanggal: new Date().toISOString().split("T")[0],
    berat_badan: "",
    tekanan_darah: "",
    tinggi_fundus: "",
    djj: "",
    keluhan: "",
    catatan: "",
    jadwal_berikutnya: "",
  };

  const initialDel = {
    tanggal: new Date().toISOString().split("T")[0],
    jenis_persalinan: "Normal",
    tempat: "Klinik",
    penolong: "",
    catatan: "",
    bayi_nama: "",
    bayi_jenis_kelamin: "Laki-laki",
    bayi_berat: "",
    bayi_panjang: "",
    apgar: "",
  };

  const [anc, setAnc] = useState(initialAnc);
  const [del, setDel] = useState(initialDel);

  const load = () => api.get(`/pregnancies/${id}`).then((r) => setData(r.data)).catch(() => {});

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) return <div className="text-stone-500 p-6">Memuat data kebidanan…</div>;
  const { pregnancy, anc: ancList, deliveries } = data;

  const saveAnc = async () => {
    if (!anc.tanggal) return toast.error("Tanggal pemeriksaan wajib diisi");
    if (anc.tekanan_darah && !/^\d{2,3}\/\d{2,3}$/.test(anc.tekanan_darah.trim())) {
      return toast.error("Format tekanan darah harus sistol/diastol, misal: 120/80");
    }

    setIsSubmitting(true);
    try {
      await api.post("/anc", {
        pregnancy_id: id,
        tanggal: anc.tanggal,
        berat_badan: Number(anc.berat_badan) || 0,
        tekanan_darah: anc.tekanan_darah.trim(),
        tinggi_fundus: Number(anc.tinggi_fundus) || 0,
        djj: anc.djj ? String(anc.djj) : "",
        keluhan: anc.keluhan,
        catatan: anc.catatan,
        jadwal_berikutnya: anc.jadwal_berikutnya || null,
      });
      toast.success("Pemeriksaan ANC tersimpan");
      setAncOpen(false);
      setAnc(initialAnc);
      load();
    } catch {
      toast.error("Gagal menyimpan data ANC");
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveDelivery = async () => {
    if (!del.tanggal) return toast.error("Tanggal persalinan wajib diisi");

    setIsSubmitting(true);
    try {
      await api.post("/deliveries", {
        pregnancy_id: id,
        tanggal: del.tanggal,
        jenis_persalinan: del.jenis_persalinan,
        tempat: del.tempat,
        penolong: del.penolong,
        catatan: del.catatan,
        bayi_nama: del.bayi_nama,
        bayi_jenis_kelamin: del.bayi_jenis_kelamin,
        bayi_berat: Number(del.bayi_berat) || 0,
        bayi_panjang: Number(del.bayi_panjang) || 0,
        apgar: del.apgar,
      });
      toast.success("Data persalinan tersimpan");
      setDelOpen(false);
      setDel(initialDel);
      load();
    } catch {
      toast.error("Gagal menyimpan data persalinan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const s = (setter) => (k) => (e) => setter((f) => ({ ...f, [k]: e.target.value }));
  const sa = s(setAnc);
  const sd = s(setDel);

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate("/kebidanan")} className="mb-4 -ml-2 text-stone-600">
        <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
      </Button>

      <Card className="p-6 border-stone-200 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-head text-2xl font-semibold text-stone-900">{pregnancy.patient_name}</h1>
              <Badge className={pregnancy.status === "Aktif" ? "bg-primary" : "bg-stone-200 text-stone-600"}>
                {pregnancy.status}
              </Badge>
            </div>
            <p className="text-stone-500 mt-1 font-mono text-sm">{pregnancy.no_rm}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setAncOpen(true)} className="bg-primary hover:bg-[#47644D]" data-testid="add-anc-button">
              <Plus className="h-4 w-4 mr-2" /> Pemeriksaan ANC
            </Button>
            {pregnancy.status === "Aktif" && (
              <Button variant="outline" onClick={() => setDelOpen(true)} data-testid="add-delivery-button">
                <Baby className="h-4 w-4 mr-2" /> Catat Persalinan
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          {[
            { l: "Usia Kehamilan", v: `${pregnancy.usia_kehamilan} mg` },
            { l: "HPHT", v: tanggalPendek(pregnancy.hpht) },
            { l: "HPL (Taksiran)", v: tanggalPendek(pregnancy.hpl) },
            { l: "G/P/A", v: `G${pregnancy.gravida}P${pregnancy.para}A${pregnancy.abortus}` },
          ].map((x) => (
            <div key={x.l} className="rounded-lg bg-stone-50 border border-stone-100 p-3">
              <p className="text-xs text-stone-500">{x.l}</p>
              <p className="font-head font-semibold text-stone-900 mt-1">{x.v}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 border-stone-200">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="font-head text-lg font-semibold text-stone-900">Riwayat Pemeriksaan ANC</h3>
          </div>
          {ancList.length === 0 ? (
            <p className="text-stone-400 text-sm py-6 text-center">Belum ada pemeriksaan ANC</p>
          ) : (
            <div className="space-y-3">
              {ancList.map((a) => (
                <div key={a.id} className="rounded-lg border border-stone-200 p-4" data-testid={`anc-row-${a.id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-stone-800">{tanggalID(a.tanggal)}</span>
                    <Badge variant="secondary" className="bg-accent text-primary font-normal">{a.usia_kehamilan} mg</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-stone-600">
                    <span>BB: {a.berat_badan || "-"} kg</span>
                    <span>TD: {a.tekanan_darah || "-"}</span>
                    <span>TFU: {a.tinggi_fundus || "-"} cm</span>
                    <span>DJJ: {a.djj || "-"}</span>
                  </div>
                  {a.keluhan && <p className="text-sm text-stone-500 mt-2">Keluhan: {a.keluhan}</p>}
                  {a.jadwal_berikutnya && (
                    <p className="text-xs text-primary mt-2 flex items-center gap-1">
                      <CalendarHeart className="h-3 w-3" /> Kontrol berikutnya: {tanggalPendek(a.jadwal_berikutnya)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 border-stone-200">
          <div className="flex items-center gap-2 mb-4">
            <Baby className="h-4 w-4 text-primary" />
            <h3 className="font-head text-lg font-semibold text-stone-900">Persalinan & Bayi</h3>
          </div>
          {deliveries.length === 0 ? (
            <p className="text-stone-400 text-sm py-6 text-center">Belum ada data persalinan</p>
          ) : (
            <div className="space-y-3">
              {deliveries.map((d) => (
                <div key={d.id} className="rounded-lg border border-stone-200 p-4" data-testid={`delivery-row-${d.id}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-stone-800">Persalinan {d.jenis_persalinan}</span>
                    <span className="text-xs text-stone-500">{tanggalPendek(d.tanggal)}</span>
                  </div>
                  <p className="text-sm text-stone-600 mt-1">Penolong: {d.penolong || "-"} • {d.tempat}</p>
                  <div className="mt-3 rounded-md bg-accent/60 p-3">
                    <p className="text-sm font-medium text-primary">
                      Bayi {d.bayi_nama ? `"${d.bayi_nama}"` : ""} — {d.bayi_jenis_kelamin}
                    </p>
                    <p className="text-sm text-stone-600 mt-0.5">
                      {d.bayi_berat || "-"} gr • {d.bayi_panjang || "-"} cm {d.apgar && `• APGAR ${d.apgar}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog open={ancOpen} onOpenChange={setAncOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-head">Pemeriksaan ANC</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label>Tanggal *</Label>
              <Input type="date" value={anc.tanggal} onChange={sa("tanggal")} className="mt-1.5" data-testid="anc-tanggal" />
            </div>
            <div>
              <Label>Berat Badan (kg)</Label>
              <Input type="number" step="0.1" value={anc.berat_badan} onChange={sa("berat_badan")} className="mt-1.5" />
            </div>
            <div>
              <Label>Tekanan Darah (cth: 120/80)</Label>
              <Input value={anc.tekanan_darah} onChange={sa("tekanan_darah")} placeholder="120/80" className="mt-1.5" />
            </div>
            <div>
              <Label>Tinggi Fundus (cm)</Label>
              <Input type="number" value={anc.tinggi_fundus} onChange={sa("tinggi_fundus")} className="mt-1.5" />
            </div>
            <div>
              <Label>DJJ (bpm)</Label>
              <Input type="number" value={anc.djj} onChange={sa("djj")} placeholder="cth: 140" className="mt-1.5" />
            </div>
            <div>
              <Label>Kontrol Berikutnya</Label>
              <Input type="date" value={anc.jadwal_berikutnya} onChange={sa("jadwal_berikutnya")} className="mt-1.5" />
            </div>
            <div className="col-span-2">
              <Label>Keluhan</Label>
              <Input value={anc.keluhan} onChange={sa("keluhan")} className="mt-1.5" />
            </div>
            <div className="col-span-2">
              <Label>Catatan</Label>
              <Textarea value={anc.catatan} onChange={sa("catatan")} rows={2} className="mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAncOpen(false)}>Batal</Button>
            <Button onClick={saveAnc} disabled={isSubmitting} className="bg-primary hover:bg-[#47644D]" data-testid="save-anc-button">
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-head">Catat Persalinan</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label>Tanggal *</Label>
              <Input type="date" value={del.tanggal} onChange={sd("tanggal")} className="mt-1.5" data-testid="delivery-tanggal" />
            </div>
            <div>
              <Label>Jenis Persalinan</Label>
              <Select value={del.jenis_persalinan} onValueChange={(v) => setDel((f) => ({ ...f, jenis_persalinan: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Normal">Normal (Spontan)</SelectItem>
                  <SelectItem value="SC">Sectio Caesarea (SC)</SelectItem>
                  <SelectItem value="Vakum">Vakum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tempat</Label>
              <Input value={del.tempat} onChange={sd("tempat")} className="mt-1.5" />
            </div>
            <div>
              <Label>Penolong</Label>
              <Input value={del.penolong} onChange={sd("penolong")} className="mt-1.5" />
            </div>
            <div className="col-span-2 border-t border-stone-100 pt-3 mt-1">
              <p className="text-sm font-semibold text-stone-700">Data Bayi</p>
            </div>
            <div>
              <Label>Nama Bayi</Label>
              <Input value={del.bayi_nama} onChange={sd("bayi_nama")} className="mt-1.5" />
            </div>
            <div>
              <Label>Jenis Kelamin</Label>
              <Select value={del.bayi_jenis_kelamin} onValueChange={(v) => setDel((f) => ({ ...f, bayi_jenis_kelamin: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                  <SelectItem value="Perempuan">Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Berat (gram)</Label>
              <Input type="number" value={del.bayi_berat} onChange={sd("bayi_berat")} className="mt-1.5" />
            </div>
            <div>
              <Label>Panjang (cm)</Label>
              <Input type="number" value={del.bayi_panjang} onChange={sd("bayi_panjang")} className="mt-1.5" />
            </div>
            <div>
              <Label>APGAR Score</Label>
              <Input value={del.apgar} onChange={sd("apgar")} placeholder="cth: 9/10" className="mt-1.5" />
            </div>
            <div className="col-span-2">
              <Label>Catatan</Label>
              <Textarea value={del.catatan} onChange={sd("catatan")} rows={2} className="mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelOpen(false)}>Batal</Button>
            <Button onClick={saveDelivery} disabled={isSubmitting} className="bg-primary hover:bg-[#47644D]" data-testid="save-delivery-button">
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
