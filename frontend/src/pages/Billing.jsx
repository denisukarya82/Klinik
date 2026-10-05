import { useEffect, useState } from "react";
import { Receipt, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import { rupiah, tanggalPendek, tanggalID } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function Billing() {
  const [invoices, setInvoices] = useState([]);
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState(null);
  const [metode, setMetode] = useState("Tunai");

  const load = async () => {
    const params = filter === "all" ? {} : { status: filter === "paid" ? "Lunas" : "Belum Bayar" };
    const { data } = await api.get("/invoices", { params });
    setInvoices(data);
  };

  useEffect(() => {
    load();
  }, [filter]);

  const pay = async () => {
    try {
      await api.post(`/invoices/${detail.id}/pay`, { metode_bayar: metode });
      toast.success("Pembayaran berhasil dicatat");
      setDetail(null);
      load();
    } catch {
      toast.error("Gagal memproses pembayaran");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-head text-3xl font-semibold text-stone-900">Tagihan & Pembayaran</h1>
          <p className="text-stone-500 mt-1">Kelola tagihan pasien</p>
        </div>
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="bg-stone-100">
            <TabsTrigger value="all" data-testid="filter-all">Semua</TabsTrigger>
            <TabsTrigger value="unpaid" data-testid="filter-unpaid">Belum Bayar</TabsTrigger>
            <TabsTrigger value="paid" data-testid="filter-paid">Lunas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card className="border-stone-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-stone-50">
              <TableHead>Tanggal</TableHead>
              <TableHead>Pasien</TableHead>
              <TableHead>No. RM</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-stone-400 py-10">
                  Tidak ada tagihan.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id} data-testid={`invoice-row-${inv.id}`} className="hover:bg-stone-50">
                  <TableCell className="text-stone-600">{tanggalPendek(inv.tanggal)}</TableCell>
                  <TableCell className="font-medium text-stone-800">{inv.patient_name}</TableCell>
                  <TableCell className="font-mono text-xs text-stone-500">{inv.no_rm}</TableCell>
                  <TableCell className="text-right font-medium text-stone-800">{rupiah(inv.total)}</TableCell>
                  <TableCell className="text-right">
                    <Badge className={inv.status === "Lunas" ? "bg-primary" : "bg-amber-100 text-amber-700"}>
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDetail(inv);
                        setMetode("Tunai");
                      }}
                      data-testid={`view-invoice-${inv.id}`}
                    >
                      <Receipt className="h-4 w-4 mr-1" /> Detail
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-md">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="font-head">Detail Tagihan</DialogTitle>
              </DialogHeader>
              <div className="py-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-stone-500">Pasien</span>
                  <span className="font-medium text-stone-800">{detail.patient_name}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-stone-500">No. RM</span>
                  <span className="font-mono text-stone-700">{detail.no_rm}</span>
                </div>
                <div className="flex justify-between text-sm mb-4">
                  <span className="text-stone-500">Tanggal</span>
                  <span className="text-stone-700">{tanggalID(detail.tanggal)}</span>
                </div>

                <div className="rounded-lg border border-stone-200 divide-y divide-stone-100">
                  {detail.items.map((it, i) => (
                    <div key={i} className="flex justify-between items-center px-3 py-2 text-sm">
                      <span className="text-stone-700">
                        {it.nama} {it.qty > 1 && <span className="text-stone-400">×{it.qty}</span>}
                      </span>
                      <span className="font-medium text-stone-800">{rupiah(it.subtotal)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center mt-4 pt-3 border-t border-stone-200">
                  <span className="font-medium text-stone-800">Total</span>
                  <span className="font-head text-xl font-semibold text-primary">{rupiah(detail.total)}</span>
                </div>

                {detail.status === "Lunas" ? (
                  <div className="mt-4 flex items-center gap-2 text-primary bg-accent rounded-lg px-4 py-3">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-sm font-medium">Lunas via {detail.metode_bayar}</span>
                  </div>
                ) : (
                  <div className="mt-4">
                    <label className="text-sm text-stone-600">Metode Pembayaran</label>
                    <Select value={metode} onValueChange={setMetode}>
                      <SelectTrigger className="mt-1.5" data-testid="payment-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Tunai">Tunai</SelectItem>
                        <SelectItem value="Transfer">Transfer Bank</SelectItem>
                        <SelectItem value="QRIS">QRIS</SelectItem>
                        <SelectItem value="BPJS">BPJS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {detail.status !== "Lunas" && (
                <DialogFooter>
                  <Button onClick={pay} className="w-full bg-primary hover:bg-[#47644D]" data-testid="confirm-payment-button">
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Tandai Lunas
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
