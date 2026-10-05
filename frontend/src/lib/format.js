export function rupiah(n) {
  const v = Number(n || 0);
  return "Rp " + v.toLocaleString("id-ID");
}

export function tanggalID(s) {
  if (!s) return "-";
  try {
    const d = new Date(s.length <= 10 ? s + "T00:00:00" : s);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return s;
  }
}

export function tanggalPendek(s) {
  if (!s) return "-";
  try {
    const d = new Date(s.length <= 10 ? s + "T00:00:00" : s);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}

export function umur(tgl) {
  if (!tgl) return "-";
  try {
    const d = new Date(tgl);
    const diff = Date.now() - d.getTime();
    const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    return `${years} th`;
  } catch {
    return "-";
  }
}
