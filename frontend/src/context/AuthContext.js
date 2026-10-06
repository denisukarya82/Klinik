import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/apiClient";
import { RefreshCw } from "lucide-react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Inisialisasi awal user dari localStorage agar langsung terisi saat reload (instan)
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("auth_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    api
      .get("/auth/me")
      .then((r) => {
        if (!isMounted) return;
        setUser(r.data);
        localStorage.setItem("auth_user", JSON.stringify(r.data));
      })
      .catch(() => {
        if (!isMounted) return;
        // Jika gagal verifikasi, hapus data cache
        setUser(false);
        localStorage.removeItem("auth_user");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setUser(data);
    localStorage.setItem("auth_user", JSON.stringify(data));
    return data;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    setUser(false);
    localStorage.removeItem("auth_user");
  };

  // Kunci utama: Tahan render halaman sampai verifikasi sesi selesai
  if (loading && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50">
        <RefreshCw className="h-7 w-7 text-primary animate-spin mb-3" />
        <p className="text-sm font-medium text-stone-600">Menghubungkan ke My Klinik…</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
