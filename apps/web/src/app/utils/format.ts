// app/utils/format.ts

export const statusLabel = (s: number) => ["Pending", "Submitted", "Approved", "Rejected", "Paid", "Claimed"][s] ?? `Unknown(${s})`;

export function trimAddr(addr?: string) {
  if (!addr) return "";
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function formatDate(isoString?: string) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleDateString("ko-KR", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

// 아래 함수들도 나중에 Detail 컴포넌트 분리할 때 필요하니 미리 옮겨두면 좋습니다.
export function formatDuration(sec: number) {
  let s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.ceil(s / 60); 
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function isImage(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);
}

export function statusBadgeStyle(s: number): React.CSSProperties {
  const map: Record<number, React.CSSProperties> = {
    0: { background: "#eef2ff", color: "#3730a3", borderColor: "#c7d2fe" },
    1: { background: "#fff7ed", color: "#9a3412", borderColor: "#fed7aa" },
    2: { background: "#ecfeff", color: "#155e75", borderColor: "#a5f3fc" },
    3: { background: "#fef2f2", color: "#991b1b", borderColor: "#fecaca" },
    4: { background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" },
  };
  return map[s] ?? { background: "#f3f4f6", color: "#111827", borderColor: "#e5e7eb" };
}