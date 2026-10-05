import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { HeartPulse, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatApiErrorDetail } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Kata sandi berhasil diperbarui. Silakan masuk.");
      navigate("/login");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm fade-up">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <HeartPulse className="h-6 w-6" />
          </div>
          <p className="font-head text-xl font-semibold text-stone-900">Atur Ulang Kata Sandi</p>
        </div>

        {!token ? (
          <p className="text-stone-600 text-sm">
            Tautan tidak valid.{" "}
            <Link to="/forgot-password" className="text-primary hover:underline">
              Minta tautan baru
            </Link>
          </p>
        ) : (
          <form onSubmit={submit} data-testid="reset-form">
            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">
                {error}
              </div>
            )}
            <Label htmlFor="password">Kata Sandi Baru</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1.5"
              data-testid="reset-password"
            />
            <Button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-primary hover:bg-[#47644D]"
              data-testid="reset-submit-button"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Simpan Kata Sandi
            </Button>
            <div className="mt-4 text-center">
              <Link to="/login" className="text-sm text-primary hover:underline">
                Kembali ke halaman masuk
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
