import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Phone, MapPin, Droplet, Baby, Stethoscope } from "lucide-react";
import { api } from "@/lib/apiClient";
import { rupiah, tanggalID, tanggalPendek, umur } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/patients/${id}`).then((r) => setData(r.data)).catch(() => {});
  }, [id]);

  if (!data) return <div className="text-stone-500">Memuat…</div>;
  const { patient, visits, pregnancies } = data;

  const Info = ({ icon: Icon, label, value }) => (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-stone-500">{label}</p>
        <p className="text-sm font-medium text-stone-800">{value || "-"}</p>
      </div>
    </div>
  );

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate("/pasien")} className="mb-4 -ml-2 text-stone-600">
        <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
      </Button>

      <Card className="p-6 border-stone-200 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-head text-2xl font-semibold text-stone-900">{patient.nama}</h1>
              <Badge variant="secondary" className="font-mono bg-stone-100 text-stone-600">
                {patient.no_rm}
              </Badge>
            </div>
            <p className="text-stone-500 mt-1">
              {patient.jenis_kelamin} • {umur(patient.tanggal_lahir)} •{" "}
              {patient.tanggal_lahir ? tanggalID(patient.tanggal_lahir) : "Tgl lahir tidak diisi"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-6">
          <Info icon={Phone} label="Telepon" value={patient.telepon} />
          <Info icon={Droplet} label="Gol. Darah" value={patient.golongan_darah} />
          <Info icon={MapPin} label="Alamat" value={patient.alamat} />
          <Info icon={Baby} label="Suami/PJ" value={patient.nama_suami} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 border-stone-200">
          <div className="flex items-center gap-2 mb-4">
            <Stethoscope className="h-4 w-4 text-primary" />
            <h3 className="font-head text-lg font-semibold text-stone-900">Riwayat Kunjungan</h3>
          </div>
          {visits.length === 0 ? (
            <p className="text-stone-400 text-sm py-6 text-center">Belum ada kunjungan</p>
          ) : (
            <div className="space-y-3">
              {visits.map((v) => (
                <div key={v.id} className="rounded-lg border border-stone-200 p-4" data-testid={`detail-visit-${v.id}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-stone-800">{v.diagnosa || "Pemeriksaan"}</p>
                    <span className="text-xs text-stone-500">{tanggalPendek(v.tanggal)}</span>
                  </div>
                  {v.keluhan && <p className="text-sm text-stone-600 mt-1">Keluhan: {v.keluhan}</p>}
                  {v.prescriptions?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {v.prescriptions.map((p, i) => (
                        <Badge key={i} variant="secondary" className="bg-accent text-primary font-normal">
                          {p.drug_name} ×{p.qty}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-100">
                    <span className="text-sm font-medium text-stone-700">{rupiah(v.total)}</span>
                    <Badge className={v.status_bayar === "Lunas" ? "bg-primary" : "bg-amber-100 text-amber-700"}>
                      {v.status_bayar}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6 border-stone-200">
          <div className="flex items-center gap-2 mb-4">
            <Baby className="h-4 w-4 text-primary" />
            <h3 className="font-head text-lg font-semibold text-stone-900">Riwayat Kehamilan</h3>
          </div>
          {pregnancies.length === 0 ? (
            <p className="text-stone-400 text-sm py-6 text-center">Belum ada data kehamilan</p>
          ) : (
            <div className="space-y-3">
              {pregnancies.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-stone-200 p-4 cursor-pointer hover:bg-stone-50"
                  onClick={() => navigate(`/kebidanan/${p.id}`)}
                  data-testid={`detail-pregnancy-${p.id}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-stone-800">
                      G{p.gravida}P{p.para}A{p.abortus}
                    </p>
                    <Badge className={p.status === "Aktif" ? "bg-primary" : "bg-stone-200 text-stone-600"}>
                      {p.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-stone-600 mt-1">HPHT: {tanggalPendek(p.hpht)}</p>
                  <p className="text-sm text-stone-600">HPL: {tanggalPendek(p.hpl)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
