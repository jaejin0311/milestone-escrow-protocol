// app/utils/format.ts

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