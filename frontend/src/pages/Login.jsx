import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { HeartPulse, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const HERO =
  "https://images.unsplash.com/photo-1758654860024-9e352f70d1f9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzV8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBtZWRpY2FsJTIwY2xpbmljJTIwd2FpdGluZyUyMHJvb20lMjB3YXJtfGVufDB8fHx8MTc5MTIyNTU3NXww&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:block relative">
        <img src={HERO} alt="Klinik" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-primary/35" />
        <div className="absolute bottom-0 p-12 text-white">
          <h2 className="font-head text-4xl font-semibold leading-tight max-w-md">
            Pelayanan Kebidanan yang Terorganisir
          </h2>
          <p className="mt-4 text-white/85 max-w-sm">
            Kelola data pasien, rekam medis, resep obat, kehamilan, dan tagihan dalam satu sistem.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 bg-background">
        <form onSubmit={submit} className="w-full max-w-sm fade-up" data-testid="login-form">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-11 w-11 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <HeartPulse className="h-6 w-6" />
            </div>
            <div>
              <p className="font-head text-xl font-semibold text-stone-900">Klinik Bidan Sehat</p>
              <p className="text-sm text-stone-500">Masuk ke akun Anda</p>
            </div>
          </div>

          {error && (
            <div
              className="mb-4 rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3"
              data-testid="login-error"
            >
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                required
                data-testid="login-email"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="password">Kata Sandi</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                data-testid="login-password"
                className="mt-1.5"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            data-testid="login-submit-button"
            className="w-full mt-6 bg-primary hover:bg-[#47644D]"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Masuk
          </Button>

          <div className="mt-4 flex flex-col items-center gap-2">
            <Link
              to="/forgot-password"
              className="text-sm text-stone-500 hover:text-stone-800"
              data-testid="forgot-password-link"
            >
              Lupa kata sandi?
            </Link>
            <p className="text-sm text-stone-500">
              Belum punya akun?{" "}
              <Link
                to="/register"
                className="text-primary font-semibold hover:underline"
                data-testid="register-link"
              >
                Daftar sekarang
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
