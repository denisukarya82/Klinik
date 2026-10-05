import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Baby, CalendarHeart } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import { tanggalPendek } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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

const HERO =
  "https://images.unsplash.com/photo-1711313532327-2f47602eb6ba?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA4Mzl8MHwxfHNlYXJjaHwyfHxtaWR3aWZlJTIwbWF0ZXJuaXR5JTIwbW90aGVyJTIwY2xpbmljfGVufDB8fHx8MTc5MTIyNTU3NXww&ixlib=rb-4.1.0&q=85";

export default function Maternity() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [patients, setPatients] = useState([]);
  const [filter, setFilter] = useState("Aktif");
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [patientId, setPatientId] = useState("");
  const [hpht, setHpht] = useState("");
  const [gravida, setGravida] = useState(1);
  const [para, setPara] = useState(0);
  const [abortus, setAbortus] = useState(0);
  const [catatan, setCatatan] = useState("");

  const load = async () => {
    const params = filter === "all" ? {} : { status: filter };
    const [pg, p] = await Promise.all([
      api.get("/pregnancies", { params }),
      api.get("/patients"),
    ]);
    setList(pg.data);
    setPatients(p.data);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const save = async () => {
    if (!patientId) return toast.error("Pilih pasien");
    if (!hpht) return toast.error("Isi HPHT (hari pertama haid terakhir)");

    const g = Number(gravida);
    const p = Number(para);
    const a = Number(abortus);

    if (g < p + a + 1) {
      return toast.error("Nilai Gravida (kehamilan sekarang) minimal harus Para + Abortus + 1");
    }

    setIsSubmitting(true);
    try {
      await api.post("/pregnancies", {
        patient_id: patientId,
        hpht,
        gravida: g,
        para: p,
        abortus: a,
        catatan,
      });
      toast.success("Data kehamilan ditambahkan");
      setOpen(false);
      setPatientId("");
      setHpht("");
      setGravida(1);
      setPara(0);
      setAbortus(0);
      setCatatan("");
      load();
    } catch {
      toast.error("Gagal menyimpan data kehamilan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const perempuan = patients.filter((p) => p.jenis_kelamin === "Perempuan");

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-head text-3xl font-semibold text-stone-900">Kebidanan / ANC</h1>
          <p className="text-stone-500 mt-1">Pantau kehamilan dan pemeriksaan antenatal</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-[#47644D]" data-testid="add-pregnancy-button">
          <Plus className="h-4 w-4 mr-2" /> Daftar Kehamilan
        </Button>
      </div>

      <Tabs value={filter} onValueChange={setFilter} className="mb-5">
        <TabsList className="bg-stone-100">
          <TabsTrigger value="Aktif" data-testid="preg-filter-aktif">Aktif</TabsTrigger>
          <TabsTrigger value="Selesai" data-testid="preg-filter-selesai">Selesai</TabsTrigger>
          <TabsTrigger value="all" data-testid="preg-filter-all">Semua</TabsTrigger>
        </TabsList>
      </Tabs>

      {list.length === 0 ? (
        <Card className="border-stone-200 overflow-hidden">
          <div className="grid md:grid-cols-2">
            <div className="p-10 flex flex-col justify-center">
              <Baby className="h-10 w-10 text-primary mb-3" />
              <h3 className="font-head text-xl font-semibold text-stone-900">Belum ada data kehamilan</h3>
              <p className="text-stone-500 mt-2 text-sm">
                Daftarkan kehamilan pasien untuk mulai memantau jadwal ANC, usia kehamilan, dan taksiran persalinan.
              </p>
            </div>
            <img src={HERO} alt="Kebidanan" className="h-full w-full object-cover min-h-[220px]" />
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {list.map((p) => {
            const pct = Math.min(100, Math.round(((p.usia_kehamilan || 0) / 40) * 100));
            return (
              <Card
                key={p.id}
                className="p-5 border-stone-200 cursor-pointer hover:shadow-sm fade-up"
                onClick={() => navigate(`/kebidanan/${p.id}`)}
                data-testid={`pregnancy-card-${p.id}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-head font-semibold text-stone-900">{p.patient_name}</p>
                    <p className="text-xs text-stone-500 font-mono">{p.no_rm}</p>
                  </div>
                  <Badge className={p.status === "Aktif" ? "bg-primary" : "bg-stone-200 text-stone-600"}>
                    {p.status}
                  </Badge>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-stone-500">Usia Kehamilan</span>
                    <span className="font-medium text-stone-800">{p.usia_kehamilan} minggu</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
                  <div className="flex items-center gap-1.5 text-stone-600">
                    <CalendarHeart className="h-3.5 w-3.5 text-[#D97B66]" />
                    HPL: {tanggalPendek(p.hpl)}
                  </div>
                  <div className="text-stone-600 text-right">
                    G{p.gravida}P{p.para}A{p.abortus}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-head">Daftar Kehamilan Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Pasien (Ibu) *</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger className="mt-1.5" data-testid="preg-patient-select">
                  <SelectValue placeholder="Pilih pasien" />
                </SelectTrigger>
                <SelectContent>
                  {perempuan.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nama} ({p.no_rm})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>HPHT (Hari Pertama Haid Terakhir) *</Label>
              <Input
                type="date"
                max={new Date().toISOString().split("T")[0]}
                value={hpht}
                onChange={(e) => setHpht(e.target.value)}
                className="mt-1.5"
                data-testid="preg-hpht"
              />
              <p className="text-xs text-stone-400 mt-1">HPL & usia kehamilan dihitung otomatis.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Gravida</Label>
                <Input type="number" min={1} value={gravida} onChange={(e) => setGravida(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Para</Label>
                <Input type="number" min={0} value={para} onChange={(e) => setPara(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>Abortus</Label>
                <Input type="number" min={0} value={abortus} onChange={(e) => setAbortus(e.target.value)} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Catatan</Label>
              <Textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} className="mt-1.5" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={isSubmitting} className="bg-primary hover:bg-[#47644D]" data-testid="save-pregnancy-button">
              {isSubmitting ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
