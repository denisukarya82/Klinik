import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      return toast.error("Semua kolom wajib diisi");
    }

    setIsLoading(true);
    try {
      await api.post("/auth/register", {
        name,
        email,
        password,
      });
      toast.success("Akun berhasil dibuat! Silakan masuk.");
      navigate("/login");
    } catch (err) {
      const msg = err.response?.data?.detail || "Gagal mendaftarkan akun";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <Card className="w-full max-w-md border-stone-200">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold font-head text-center text-stone-900">
            Daftar Akun Staf
          </CardTitle>
          <CardDescription className="text-center text-stone-500">
            Buat akun baru untuk akses sistem klinik
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <Label htmlFor="name">Nama Lengkap</Label>
              <Input
                id="name"
                placeholder="Bidan / Petugas..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@klinik.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Kata Sandi</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimal 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-[#47644D]"
            >
              {isLoading ? "Mendaftarkan..." : "Daftar Sekarang"}
            </Button>
            <div className="text-center text-sm text-stone-500 mt-4">
              Sudah punya akun?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Masuk di sini
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
