import { useEffect, useState, useCallback } from "react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import { rupiah } from "@/lib/format";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const EMPTY = { nama: "", kategori: "Obat", satuan: "Tablet", harga: 0, stok: 0 };

export default function Drugs() {
  const [drugs, setDrugs] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [delId, setDelId] = useState(null);

  const load = useCallback(async (search = "") => {
    const { data } = await api.get("/drugs", { params: search ? { q: search } : {} });
    setDrugs(data);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  const openNew = () => {
    setForm(EMPTY);
    setEditId(null);
    setOpen(true);
  };
  const openEdit = (d) => {
    setForm({ nama: d.nama, kategori: d.kategori, satuan: d.satuan, harga: d.harga, stok: d.stok });
    setEditId(d.id);
    setOpen(true);
  };

  const save = async () => {
    if (!form.nama.trim()) return toast.error("Nama obat wajib diisi");
    const payload = { ...form, harga: Number(form.harga) || 0, stok: Number(form.stok) || 0 };
    try {
      if (editId) {
        await api.put(`/drugs/${editId}`, payload);
        toast.success("Obat diperbarui");
      } else {
        await api.post("/drugs", payload);
        toast.success("Obat ditambahkan");
      }
      setOpen(false);
      load(q);
    } catch {
      toast.error("Gagal menyimpan");
    }
  };

  const remove = async () => {
    try {
      await api.delete(`/drugs/${delId}`);
      toast.success("Obat dihapus");
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
          <h1 className="font-head text-3xl font-semibold text-stone-900">Data Obat & Harga</h1>
          <p className="text-stone-500 mt-1">{drugs.length} item obat tersedia</p>
        </div>
        <Button onClick={openNew} className="bg-primary hover:bg-[#47644D]" data-testid="add-drug-button">
          <Plus className="h-4 w-4 mr-2" /> Tambah Obat
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari obat…" className="pl-9" data-testid="drug-search" />
      </div>

      <Card className="border-stone-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-stone-50">
              <TableHead>Nama Obat</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Satuan</TableHead>
              <TableHead className="text-right">Harga</TableHead>
              <TableHead className="text-right">Stok</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {drugs.map((d) => (
              <TableRow key={d.id} data-testid={`drug-row-${d.id}`} className="hover:bg-stone-50">
                <TableCell className="font-medium text-stone-800">{d.nama}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="bg-accent text-primary font-normal">{d.kategori}</Badge>
                </TableCell>
                <TableCell className="text-stone-600">{d.satuan}</TableCell>
                <TableCell className="text-right font-medium text-stone-800">{rupiah(d.harga)}</TableCell>
                <TableCell className="text-right">
                  <span className={d.stok <= 20 ? "text-destructive font-medium" : "text-stone-600"}>{d.stok}</span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(d)} data-testid={`edit-drug-${d.id}`}>
                      <Pencil className="h-4 w-4 text-stone-500" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDelId(d.id)} data-testid={`delete-drug-${d.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-head">{editId ? "Edit Obat" : "Tambah Obat"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nama Obat *</Label>
              <Input value={form.nama} onChange={set("nama")} className="mt-1.5" data-testid="drug-nama" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Kategori</Label>
                <Input value={form.kategori} onChange={set("kategori")} className="mt-1.5" />
              </div>
              <div>
                <Label>Satuan</Label>
                <Input value={form.satuan} onChange={set("satuan")} className="mt-1.5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Harga (Rp)</Label>
                <Input type="number" value={form.harga} onChange={set("harga")} className="mt-1.5" data-testid="drug-harga" />
              </div>
              <div>
                <Label>Stok</Label>
                <Input type="number" value={form.stok} onChange={set("stok")} className="mt-1.5" data-testid="drug-stok" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} className="bg-primary hover:bg-[#47644D]" data-testid="save-drug-button">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus obat ini?</AlertDialogTitle>
            <AlertDialogDescription>Data obat akan dihapus permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive hover:bg-destructive/90">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
