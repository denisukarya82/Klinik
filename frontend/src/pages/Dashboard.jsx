import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Baby, Stethoscope, Wallet, AlertCircle, Pill } from "lucide-react";
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

const StatCard = ({ icon: Icon, label, value, sub, tint, delay, testid }) => (
  <Card
    className="p-5 border-stone-200 fade-up"
    style={{ animationDelay: `${delay}ms` }}
    data-testid={testid}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-wider text-stone-500 font-medium">{label}</p>
        <p className="font-head text-2xl font-semibold text-stone-900 mt-2">{value}</p>
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
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/dashboard/stats").then((r) => setS(r.data)).catch(() => {});
  }, []);

  if (!s)
    return <div className="text-stone-500">Memuat dashboard…</div>;

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
          value={rupiah(s.revenue_month)}
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
          {s.chart.length === 0 ? (
            <p className="text-stone-400 text-sm py-12 text-center">Belum ada data kunjungan</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={s.chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
                <XAxis dataKey="bulan" tick={{ fontSize: 12, fill: "#78716c" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#78716c" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: "rgba(91,124,98,0.06)" }} />
                <Bar dataKey="kunjungan" fill="#5B7C62" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5 border-stone-200 fade-up" style={{ animationDelay: "260ms" }}>
            <div className="flex items-center gap-2 text-stone-700">
              <AlertCircle className="h-4 w-4 text-[#C25a43]" />
              <span className="text-sm font-medium">Tagihan Belum Lunas</span>
            </div>
            <p className="font-head text-2xl font-semibold text-stone-900 mt-2">
              {rupiah(s.unpaid_total)}
            </p>
            <p className="text-xs text-stone-500 mt-1">{s.unpaid_count} tagihan menunggu pembayaran</p>
          </Card>
          <Card className="p-5 border-stone-200 fade-up" style={{ animationDelay: "300ms" }}>
            <div className="flex items-center gap-2 text-stone-700">
              <Pill className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Jenis Obat Tersedia</span>
            </div>
            <p className="font-head text-2xl font-semibold text-stone-900 mt-2">{s.total_drugs}</p>
            <p className="text-xs text-stone-500 mt-1">Item dalam daftar obat</p>
          </Card>
        </div>
      </div>

      <Card className="mt-6 p-6 border-stone-200 fade-up" style={{ animationDelay: "340ms" }}>
        <h3 className="font-head text-lg font-semibold text-stone-900 mb-4">Kunjungan Terbaru</h3>
        {s.recent_visits.length === 0 ? (
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
                  <span className="text-sm font-medium text-stone-700">{rupiah(v.total)}</span>
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
