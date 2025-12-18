"use client"; // 👈 중요: useState를 쓰려면 이게 맨 위에 있어야 합니다.

import { useState, useMemo } from 'react';

// 에스크로 데이터 타입 정의 (필요한 필드에 맞춰 수정하세요)
interface Escrow {
  id: string | number;
  address: string;
  client: string;
  provider: string;
  amount: string | number;
  status: number; // 0, 1, 2, 3
}

interface MyEscrowListProps {
  escrows: Escrow[];
  myAddress: string;
}

// 상태값 매핑 (Smart Contract의 Enum 순서와 일치해야 함)
const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: '신청됨', color: 'bg-yellow-100 text-yellow-800' },
  1: { label: '진행중', color: 'bg-blue-100 text-blue-800' },
  2: { label: '완료됨', color: 'bg-green-100 text-green-800' },
  3: { label: '환불됨', color: 'bg-red-100 text-red-800' },
};

export default function MyEscrowList({ escrows, myAddress }: MyEscrowListProps) {
  // 1. 뷰 상태 관리
  const [activeRole, setActiveRole] = useState<'CLIENT' | 'PROVIDER'>('CLIENT');
  const [activeTab, setActiveTab] = useState<string>('ALL');

  // 2. 필터링 로직
  const filteredData = useMemo(() => {
    if (!escrows || !myAddress) return [];

    return escrows.filter((item) => {
      // (1) 역할(Role) 필터링
      const isClient = item.client.toLowerCase() === myAddress.toLowerCase();
      const isProvider = item.provider.toLowerCase() === myAddress.toLowerCase();

      const roleMatch = activeRole === 'CLIENT' ? isClient : isProvider;
      if (!roleMatch) return false;

      // (2) 상태(Status) 필터링
      if (activeTab === 'ALL') return true;
      return item.status.toString() === activeTab;
    });
  }, [escrows, myAddress, activeRole, activeTab]);

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      {/* --- A. 역할 스위처 (Role Switcher) --- */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 p-1 rounded-lg inline-flex">
          <button
            onClick={() => setActiveRole('CLIENT')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
              activeRole === 'CLIENT'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            구매 내역 (Client)
          </button>
          <button
            onClick={() => setActiveRole('PROVIDER')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${
              activeRole === 'PROVIDER'
                ? 'bg-white text-green-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            판매 내역 (Provider)
          </button>
        </div>
      </div>

      {/* --- B. 상태 탭 (Status Tabs) --- */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {['ALL', '0', '1', '2', '3'].map((tabKey) => {
            const label = tabKey === 'ALL' ? '전체' : STATUS_LABELS[parseInt(tabKey)]?.label;
            return (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey)}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tabKey
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* --- C. 리스트 출력 --- */}
      <div className="space-y-4">
        {filteredData.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <p className="text-gray-500">해당하는 내역이 없습니다.</p>
          </div>
        ) : (
          filteredData.map((escrow) => (
            <div key={escrow.id} className="border rounded-lg p-5 shadow-sm hover:shadow-md transition bg-white">
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold text-lg text-gray-800">Escrow #{escrow.id}</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_LABELS[escrow.status]?.color}`}>
                  {STATUS_LABELS[escrow.status]?.label || 'Unknown'}
                </span>
              </div>
              
              <div className="text-sm text-gray-600 space-y-1 bg-gray-50 p-3 rounded">
                <div className="flex justify-between">
                  <span className="font-semibold">Contract:</span> 
                  <span className="font-mono text-xs truncate ml-2 w-48 text-right">{escrow.address}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold">Amount:</span> 
                  <span>{escrow.amount} ETH</span>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline">
                  상세보기 &rarr;
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}