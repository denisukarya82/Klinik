import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Baby, Stethoscope, Wallet, AlertCircle, Pill, RefreshCw } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { api } from "@/lib/apiClient";
import { rupiah, tanggalPendek } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const StatCard = ({ icon: Icon, label, value, sub, tint, delay, testid }) => (
  <Card
    className="p-5 border-stone-200 fade-up"
    style={{ animationDelay: `${delay}ms` }}
    data-testid={testid}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-wider text-stone-500 font-medium">{label}</p>
        <p className="font-head text-2xl font-semibold text-stone-900 mt-2">{value ?? 0}</p>
        {sub && <p className="text-xs text-stone-500 mt-1">{sub}</p>}
      </div>
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${tint}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </Card>
);

export default function Dashboard() {
  const [s, setS] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchStats = () => {
    setLoading(true);
    setError(null);
    api.get("/dashboard/stats")
      .then((r) => {
        setS(r.data);
      })
      .catch((err) => {
        setError(err.response?.data?.message || err.message || "Gagal memuat data");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-stone-500 py-12">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span>Memuat data dashboard…</span>
      </div>
    );
  }

  if (error || !s) {
    return (
      <div className="py-12 text-center max-w-sm mx-auto">
        <p className="text-red-500 font-medium mb-2">Gagal menampilkan dashboard</p>
        <p className="text-xs text-stone-500 mb-4">{error || "Koneksi ke backend bermasalah"}</p>
        <Button onClick={fetchStats} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" /> Coba Lagi
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-head text-3xl font-semibold text-stone-900">Dashboard</h1>
        <p className="text-stone-500 mt-1">Ringkasan aktivitas klinik hari ini</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Users}
          label="Total Pasien"
          value={s.total_patients}
          tint="bg-accent text-primary"
          delay={0}
          testid="stat-patients"
        />
        <StatCard
          icon={Stethoscope}
          label="Kunjungan Hari Ini"
          value={s.visits_today}
          tint="bg-[#D97B66]/15 text-[#C25a43]"
          delay={60}
          testid="stat-visits-today"
        />
        <StatCard
          icon={Baby}
          label="Ibu Hamil Aktif"
          value={s.active_pregnancies}
          tint="bg-[#6b8caf]/15 text-[#3f6690]"
          delay={120}
          testid="stat-pregnancies"
        />
        <StatCard
          icon={Wallet}
          label="Pendapatan Bulan Ini"
          value={rupiah(s.revenue_month || 0)}
          sub="Dari tagihan lunas"
          tint="bg-accent text-primary"
          delay={180}
          testid="stat-revenue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 border-stone-200 fade-up" style={{ animationDelay: "220ms" }}>
          <h3 className="font-head text-lg font-semibold text-stone-900 mb-4">
            Kunjungan per Bulan
          </h3>
          {!s.chart || s.chart.length === 0 ? (
            <p className="text-stone-400 text-sm py-12 text-center">Belum ada data kunjungan</p>
          ) : (
            <div className="w-full h-[260px] min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={s.chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                  <XAxis dataKey="bulan" tick={{ fontSize: 12, fill: "#78716c" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#78716c" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "rgba(91,124,98,0.06)" }} />
                  <Bar dataKey="kunjungan" fill="#5B7C62" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5 border-stone-200 fade-up" style={{ animationDelay: "260ms" }}>
            <div className="flex items-center gap-2 text-stone-700">
              <AlertCircle className="h-4 w-4 text-[#C25a43]" />
              <span className="text-sm font-medium">Tagihan Belum Lunas</span>
            </div>
            <p className="font-head text-2xl font-semibold text-stone-900 mt-2">
              {rupiah(s.unpaid_total || 0)}
            </p>
            <p className="text-xs text-stone-500 mt-1">{s.unpaid_count || 0} tagihan menunggu pembayaran</p>
          </Card>
          <Card className="p-5 border-stone-200 fade-up" style={{ animationDelay: "300ms" }}>
            <div className="flex items-center gap-2 text-stone-700">
              <Pill className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Jenis Obat Tersedia</span>
            </div>
            <p className="font-head text-2xl font-semibold text-stone-900 mt-2">{s.total_drugs || 0}</p>
            <p className="text-xs text-stone-500 mt-1">Item dalam daftar obat</p>
          </Card>
        </div>
      </div>

      <Card className="mt-6 p-6 border-stone-200 fade-up" style={{ animationDelay: "340ms" }}>
        <h3 className="font-head text-lg font-semibold text-stone-900 mb-4">Kunjungan Terbaru</h3>
        {!s.recent_visits || s.recent_visits.length === 0 ? (
          <p className="text-stone-400 text-sm py-8 text-center">Belum ada kunjungan</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {s.recent_visits.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between py-3 cursor-pointer hover:bg-stone-50 -mx-2 px-2 rounded-md"
                onClick={() => navigate(`/pasien/${v.patient_id}`)}
                data-testid={`recent-visit-${v.id}`}
              >
                <div>
                  <p className="font-medium text-stone-800">{v.patient_name}</p>
                  <p className="text-xs text-stone-500">
                    {v.diagnosa || v.keluhan || "Pemeriksaan"} • {tanggalPendek(v.tanggal)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-stone-700">{rupiah(v.total || 0)}</span>
                  <Badge
                    variant={v.status_bayar === "Lunas" ? "default" : "secondary"}
                    className={v.status_bayar === "Lunas" ? "bg-primary" : "bg-amber-100 text-amber-700"}
                  >
                    {v.status_bayar}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
