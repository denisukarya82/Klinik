import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Pill,
  Stethoscope,
  Receipt,
  Baby,
  LogOut,
  Menu,
  X,
  HeartPulse,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, id: "dashboard" },
  { to: "/pasien", label: "Data Pasien", icon: Users, id: "pasien" },
  { to: "/kunjungan", label: "Kunjungan & Resep", icon: Stethoscope, id: "kunjungan" },
  { to: "/kebidanan", label: "Kebidanan / ANC", icon: Baby, id: "kebidanan" },
  { to: "/obat", label: "Data Obat", icon: Pill, id: "obat" },
  { to: "/tagihan", label: "Tagihan", icon: Receipt, id: "tagihan" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-6 flex items-center gap-3 border-b border-stone-200/70">
        <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
          <HeartPulse className="h-5 w-5" />
        </div>
        <div>
          <p className="font-head font-semibold text-stone-900 leading-tight">Klinik Bidan</p>
          <p className="text-xs text-stone-500">Sistem Informasi</p>
        </div>
      </div>
      <nav className="flex-1 px-3 py-5 space-y-1">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={() => setOpen(false)}
            data-testid={`nav-${n.id}`}
            className={({ isActive }) =>
              `nav-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-stone-600 hover:bg-stone-200/60 hover:text-stone-900"
              }`
            }
          >
            <n.icon className="h-[18px] w-[18px]" />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-stone-200/70">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-stone-800 truncate">{user?.name || "Pengguna"}</p>
          <p className="text-xs text-stone-500 truncate">{user?.email}</p>
        </div>
        <Button
          variant="ghost"
          onClick={handleLogout}
          data-testid="logout-button"
          className="w-full justify-start text-stone-600 hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4 mr-2" /> Keluar
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 sidebar-bg border-r border-stone-200/70 flex-col">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 sidebar-bg shadow-xl">
            <button
              className="absolute right-3 top-4 text-stone-500"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-stone-200 bg-card">
          <button onClick={() => setOpen(true)} data-testid="menu-button">
            <Menu className="h-6 w-6 text-stone-700" />
          </button>
          <span className="font-head font-semibold">Klinik Bidan</span>
        </header>
        <main className="flex-1 p-5 sm:p-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
