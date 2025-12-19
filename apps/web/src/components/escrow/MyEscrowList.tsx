// app/components/EscrowList.tsx
"use client";

import { trimAddr, formatDate } from "../../app/utils/format";

// 필요한 데이터 타입 정의 (부모에게 받을 것들)
type EscrowMetadata = {
  address: string;
  title: string;
  created_at: string;
};

type Props = {
  escrows: string[];
  dbData?: EscrowMetadata[];
  selectedEscrow: string | null;
  onSelect: (addr: string) => void; // 부모의 refresh 함수를 실행할 트리거
};

export default function EscrowList({ escrows, dbData, selectedEscrow, onSelect }: Props) {
  // 스타일 정의
  const card: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" };

  return (
    <section style={card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontWeight: 800 }}>My Escrows</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>{escrows.length} items</div>
      </div>
      <div style={{ height: 12 }} />
      <div style={{ display: "grid", gap: 8, maxHeight: '70vh', overflowY: 'auto', paddingRight: 4 }}>
        {escrows.map((addr) => {
          const sel = addr === selectedEscrow;
          const meta = dbData?.find((d) => d.address.toLowerCase() === addr.toLowerCase());
          const title = meta?.title || "Untitled Project";
          const dateStr = formatDate(meta?.created_at);

          return (
            <button
              key={addr}
              onClick={() => onSelect(addr)} // 클릭 시 부모가 넘겨준 함수 실행
              style={{
                textAlign: "left",
                border: "1px solid",
                borderColor: sel ? "#111827" : "#e5e7eb",
                background: sel ? "#f9fafb" : "#fff",
                borderRadius: 12,
                padding: "12px 14px",
                cursor: "pointer",
                position: "relative",
                width: "100%"
              }}
            >
              {sel && <div style={{ position:'absolute', left:0, top:12, bottom:12, width:4, background:'#111827', borderTopRightRadius:4, borderBottomRightRadius:4 }} />}
              <div style={{ fontWeight: 700, fontSize: 15, color: sel ? "#000" : "#374151", marginBottom: 4 }}>{title}</div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ color: "#9ca3af", fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{trimAddr(addr)}</div>
                <div style={{ fontSize: 11, color: "#d1d5db" }}>{dateStr}</div>
              </div>
            </button>
          );
        })}
        {!escrows.length && <div style={{ color: "#9ca3af", textAlign:'center', padding: '40px 0', fontSize: 14 }}>No escrows found.</div>}
      </div>
    </section>
  );
}