import { useState } from "react";
import { Link } from "react-router-dom";
import { HeartPulse, Loader2, MailCheck } from "lucide-react";
import { api, formatApiErrorDetail } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
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
          <p className="font-head text-xl font-semibold text-stone-900">Lupa Kata Sandi</p>
        </div>

        {sent ? (
          <div className="text-center" data-testid="forgot-confirmation">
            <div className="mx-auto h-12 w-12 rounded-full bg-accent flex items-center justify-center mb-4">
              <MailCheck className="h-6 w-6 text-primary" />
            </div>
            <p className="text-stone-700">
              Jika email terdaftar, tautan atur ulang kata sandi telah dikirim. Silakan periksa kotak masuk Anda.
            </p>
            <Link to="/login" className="inline-block mt-6 text-sm text-primary hover:underline">
              Kembali ke halaman masuk
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} data-testid="forgot-form">
            <p className="text-sm text-stone-600 mb-5">
              Masukkan email Anda, kami akan mengirim tautan untuk mengatur ulang kata sandi.
            </p>
            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3">
                {error}
              </div>
            )}
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1.5"
              data-testid="forgot-email"
            />
            <Button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-primary hover:bg-[#47644D]"
              data-testid="forgot-submit-button"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Kirim Tautan
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
