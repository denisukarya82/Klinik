import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import { tanggalPendek, umur } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const EMPTY = {
  nama: "",
  nik: "",
  tanggal_lahir: "",
  jenis_kelamin: "Perempuan",
  alamat: "",
  telepon: "",
  golongan_darah: "-",
  pekerjaan: "",
  nama_suami: "",
};

export default function Patients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (search = "") => {
    const { data } = await api.get("/patients", { params: search ? { q: search } : {} });
    setPatients(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  const openNew = () => {
    setForm(EMPTY);
    setEditId(null);
    setOpen(true);
  };

  const openEdit = (p) => {
    setForm({ ...EMPTY, ...p });
    setEditId(p.id);
    setOpen(true);
  };

  const save = async () => {
    if (!form.nama.trim()) {
      toast.error("Nama pasien wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      delete payload.id;
      delete payload.no_rm;
      delete payload.created_at;
      if (editId) {
        await api.put(`/patients/${editId}`, payload);
        toast.success("Data pasien diperbarui");
      } else {
        await api.post("/patients", payload);
        toast.success("Pasien baru ditambahkan");
      }
      setOpen(false);
      load(q);
    } catch (e) {
      toast.error("Gagal menyimpan data");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/patients/${delId}`);
      toast.success("Pasien dihapus");
      setDelId(null);
      load(q);
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-head text-3xl font-semibold text-stone-900">Data Pasien</h1>
          <p className="text-stone-500 mt-1">{patients.length} pasien terdaftar</p>
        </div>
        <Button onClick={openNew} className="bg-primary hover:bg-[#47644D]" data-testid="add-patient-button">
          <Plus className="h-4 w-4 mr-2" /> Tambah Pasien
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama, No. RM, atau NIK…"
          className="pl-9"
          data-testid="patient-search"
        />
      </div>

      <Card className="border-stone-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-stone-50">
              <TableHead>No. RM</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>L/P</TableHead>
              <TableHead>Umur</TableHead>
              <TableHead>Telepon</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-stone-400 py-10">
                  Belum ada pasien. Klik "Tambah Pasien" untuk memulai.
                </TableCell>
              </TableRow>
            ) : (
              patients.map((p) => (
                <TableRow key={p.id} data-testid={`patient-row-${p.id}`} className="hover:bg-stone-50">
                  <TableCell className="font-mono text-xs text-stone-500">{p.no_rm}</TableCell>
                  <TableCell className="font-medium text-stone-800">{p.nama}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-stone-100 text-stone-600 font-normal">
                      {p.jenis_kelamin === "Perempuan" ? "P" : "L"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-stone-600">{umur(p.tanggal_lahir)}</TableCell>
                  <TableCell className="text-stone-600">{p.telepon || "-"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => navigate(`/pasien/${p.id}`)}
                        data-testid={`view-patient-${p.id}`}
                      >
                        <Eye className="h-4 w-4 text-stone-500" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)} data-testid={`edit-patient-${p.id}`}>
                        <Pencil className="h-4 w-4 text-stone-500" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDelId(p.id)} data-testid={`delete-patient-${p.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-head">
              {editId ? "Edit Pasien" : "Tambah Pasien Baru"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2">
              <Label>Nama Lengkap *</Label>
              <Input value={form.nama} onChange={set("nama")} className="mt-1.5" data-testid="form-nama" />
            </div>
            <div>
              <Label>NIK</Label>
              <Input value={form.nik} onChange={set("nik")} className="mt-1.5" data-testid="form-nik" />
            </div>
            <div>
              <Label>Tanggal Lahir</Label>
              <Input type="date" value={form.tanggal_lahir} onChange={set("tanggal_lahir")} className="mt-1.5" data-testid="form-tgl" />
            </div>
            <div>
              <Label>Jenis Kelamin</Label>
              <Select value={form.jenis_kelamin} onValueChange={(v) => setForm((f) => ({ ...f, jenis_kelamin: v }))}>
                <SelectTrigger className="mt-1.5" data-testid="form-jk">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Perempuan">Perempuan</SelectItem>
                  <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Golongan Darah</Label>
              <Select value={form.golongan_darah} onValueChange={(v) => setForm((f) => ({ ...f, golongan_darah: v }))}>
                <SelectTrigger className="mt-1.5" data-testid="form-goldar">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["-", "A", "B", "AB", "O"].map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Telepon</Label>
              <Input value={form.telepon} onChange={set("telepon")} className="mt-1.5" data-testid="form-telepon" />
            </div>
            <div>
              <Label>Pekerjaan</Label>
              <Input value={form.pekerjaan} onChange={set("pekerjaan")} className="mt-1.5" />
            </div>
            <div className="col-span-2">
              <Label>Nama Suami / Penanggung Jawab</Label>
              <Input value={form.nama_suami} onChange={set("nama_suami")} className="mt-1.5" />
            </div>
            <div className="col-span-2">
              <Label>Alamat</Label>
              <Input value={form.alamat} onChange={set("alamat")} className="mt-1.5" data-testid="form-alamat" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving} className="bg-primary hover:bg-[#47644D]" data-testid="save-patient-button">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pasien ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Data pasien akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive hover:bg-destructive/90" data-testid="confirm-delete-patient">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
