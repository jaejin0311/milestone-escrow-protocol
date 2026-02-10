# 🚀 Milestone Escrow Protocol | Performance-based Escrow Demo (Foundry + Next.js)

![Foundry](https://img.shields.io/badge/Foundry-1.5.0-black?style=flat-square)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-green?style=flat-square&logo=solidity)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Storage-3ECF8E?style=flat-square&logo=supabase)
![Viem](https://img.shields.io/badge/Viem-Client-orange?style=flat-square)

## 👋 Introduction

**"성과 기반으로 정산이 자동화되는 마일스톤 에스크로 데모입니다."**

프리랜서/외주처럼 “납품-검수-정산”이 반복되는 업무에서 발생하는 **신뢰 비용(trust cost)**을 줄이기 위해,  
정산 과정을 **스마트 컨트랙트의 상태 머신(state machine)**으로 고정해버리는 데모 프로젝트입니다.

- 클라이언트가 총 비용을 한 번 예치 (`fund()`)
- 작업자가 증빙 제출 (`submit()`)
- 클라이언트가 승인/반려 (`approve()` / `reject()`)
- 승인 시 자동 지급

이 레포에는:
- **컨트랙트 + 테스트(Foundry)**
- **웹 UI(Next.js)**
- **Codespaces 환경에서 잘 돌아가는 데모 구조**가 포함되어 있습니다.

<br/>

## 🛠 Tech Stack

| Category | Technology | Reasoning (Why I chose this) |
| :--- | :--- | :--- |
| **Smart Contract** | **Solidity 0.8.20** | 정산 로직을 on-chain 상태로 고정하여 분쟁 비용 감소 |
| **Testing** | **Foundry (forge/anvil)** | 빠른 로컬 반복 + 강력한 테스트/체인 시뮬레이션 |
| **Frontend** | **Next.js 14 (App Router)** | UI + API Routes로 데모 백엔드 구성 용이 |
| **Database** | **Supabase (PostgreSQL)** | 온체인 이벤트 인덱싱 및 빠른 UI 렌더링 (No local JSON) |
| **Web3 Client** | **viem** | 경량/현대적인 컨트랙트 read/write 클라이언트 |
| **Environment** | **GitHub Codespaces** | stateless 개발환경에서도 재현 가능한 데모 |

<br/>

## ✨ Key Features

### 1) Milestone Escrow State Machine (Functional)

각 마일스톤은 `amount`, `deadline`, `status`, `proofURI`, `reasonURI`를 가집니다.

- 정상 플로우:
  - `Pending` → `Submitted` → `Paid`
- 반려 플로우:
  - `Submitted` → `Rejected` → `Submitted` (재제출)

### 2) Sequential Milestone Enforcement (Implemented)

마일스톤은 **순서대로만 진행**됩니다.

- `submit(i)`는 **직전 마일스톤이 Paid**일 때만 허용됩니다.
- 위반 시 `PREV_NOT_PAID`로 revert 됩니다.

이로 인해 “0번 검수/정산이 끝나기 전에 1번을 먼저 제출” 같은 케이스를 **프로토콜 레벨에서 차단**합니다.

### 3) Foundry Tests (Implemented)

- 해피패스 지급 검증
- Reject 후 resubmit 동작 검증
- 권한/순서 체크 (`NOT_PROVIDER`, `NOT_FUNDED`, `PREV_NOT_PAID` 등)

### 4) Proof of Work with Storage (New!)
작업자는 텍스트 설명뿐만 아니라 **파일(이미지, 문서 등)을 업로드**하여 작업 증빙을 할 수 있습니다.
- 파일은 **Supabase Storage**에 보안 저장되며, URL이 온체인에 기록됩니다.
- UI에서 이미지 미리보기 및 다운로드 링크를 제공합니다.

### 5) Factory-based Escrow Creation & Sync
- `MilestoneEscrowFactory`에서 `createEscrow()`로 새 에스크로를 생성합니다.
- 생성된 에스크로 주소와 메타데이터는 **Supabase DB에 자동 저장**됩니다.
- 이를 통해 Testnet 환경에서도 `eth_getLogs` 제한 없이 **빠르고 영구적인 리스트 조회**가 가능합니다.

### 6) Codespaces-friendly Web Demo (Implemented)

Codespaces에서 `anvil`은 컨테이너 내부 `127.0.0.1`에 떠서, 로컬 브라우저 MetaMask가 직접 붙기 어렵습니다.  
그래서 이 데모는 다음 구조로 동작합니다.

- UI는 브라우저에서 열고
- 트랜잭션 실행은 **Next.js API Route 서버가** RPC로 붙어서 처리

즉, **지갑 연결 없이도 버튼으로 fund/submit/approve/reject가 동작**합니다. (데모 목적)

> ⚠️ Security Note: 데모 전용입니다. `.env.local`에 private key가 들어갑니다. 절대 커밋하지 마세요.

### 7) Factory-based Escrow Creation (Implemented)

- `MilestoneEscrowFactory`에서 `createEscrow()`로 새 에스크로를 생성합니다.
- UI에서 새 에스크로를 생성/선택할 수 있어, **env 주소 교체 없이 데모를 계속** 진행할 수 있습니다.
- Sepolia에서는 이벤트 로그 스캔 한계(Alchemy free tier) 때문에 생성된 주소를 로컬 파일로 캐시합니다. (아래 참고)

> ⚠️ Important: 컨트랙트를 수정했다면, 기존에 배포된 Factory/escrow의 코드는 바뀌지 않습니다.  
> 새 로직을 적용하려면 **Factory를 재배포**하고, 그 Factory로 **새 escrow를 생성**해야 합니다.

<br/>

## 🧱 Architecture

이 프로젝트는 **2가지 실행 모드**를 지원합니다.

### A) Codespaces / Local Demo (Anvil)
- `anvil` runs inside Codespaces (RPC on `127.0.0.1:8545`)
- Next.js API routes signs transactions (server-side)
- Wallet 없이도 UI 버튼으로 fund/submit/approve/reject 수행 (데모 목적)

### B) Testnet Demo (Sepolia)
- Factory를 Sepolia에 배포
- Next.js API routes가 Sepolia RPC로 트랜잭션 실행
- UI에서 factory로 escrow 생성 및 조회

```text
Browser UI
  ↕ (Data Sync)
Supabase (DB & Storage)
  ↓ (Write Action)
Next.js (API routes) ──(JSON-RPC)──> RPC (Anvil or Sepolia)
  ↓
Factory → Escrow Contracts
```
⚠️ UI는 Supabase에서 리스트를 조회하고, 트랜잭션 실행(Write)은 API Route를 통해 체인에 반영한 뒤 Supabase를 업데이트합니다.

## 🚀 Getting Started

### 0) Prerequisites
- Foundry installed
- Node.js

### 1) Smart Contract (Foundry)

```bash
cd contracts

# run local chain
anvil
```

In a second terminal:
```bash
cd contracts

# (optional) install deps if needed
forge install foundry-rs/forge-std

# run tests
forge test
```

### 2) Deploy Factory (Sepolia)
```bash
cd contracts
set -a
source .env
set +a

forge script script/DeployFactory.s.sol:DeployFactory \
  --sig "run()" \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --broadcast \
  --private-key "$DEPLOYER_PK" \
  -vv
```
출력의 Contract Address: 0x... (Factory Address)를 복사합니다.

### 3) Run Web UI
`apps/web/.env.local` 생성 (절대 커밋하지 마세요):

#### Option A) Anvil (Codespaces/Local)
ESCROW_RPC_URL=http://127.0.0.1:8545
FACTORY_ADDRESS=0xYOUR_FACTORY_ADDRESS

```bash
# demo keys (anvil default)
CLIENT_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
PROVIDER_PK=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
```
#### Option B) Sepolia (Testnet)
```bash
ESCROW_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
FACTORY_ADDRESS=0xYOUR_FACTORY_ADDRESS

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# demo keys (Sepolia wallet private keys)
# NOTE: 반드시 0x prefix 포함
CLIENT_PK=0x...
PROVIDER_PK=0x...
```
실행:
```bash
cd apps/web
npm install
npm run dev -- --hostname 0.0.0.0 --port 3000
```
  Codespaces에서 포트 3000을 열면 UI가 뜹니다.
  ⚠️ Security Note: 데모 전용입니다. .env.local에 private key가 들어갑니다. 절대 커밋하지 마세요.

### 4) Supabase setup (required for escrow list + proof storage)

Create a Supabase project and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `apps/web/.env.local`.

**Table `escrows`** (SQL Editor):

```sql
create table public.escrows (
  id bigint generated by default as identity primary key,
  address text not null unique,
  client_address text not null,
  provider_address text not null,
  total_amount text not null,
  title text not null default 'Untitled Project',
  chain_id bigint not null,
  created_at timestamptz not null default now()
);
```

**Storage bucket `proofs`**: In Supabase Dashboard → Storage, create a bucket named `proofs`. Use a public bucket or add a policy so that anon can read (and optionally insert) objects; the app uploads proof files and stores the public URL on-chain.

<br/>

## ✅ Demo Flow
UI에서 순서대로:

1. fund() as CLIENT

2. submit(0, proofURI) as PROVIDER

3. approve(0) as CLIENT

4. milestone 1도 동일 반복
  Note: submit(1, ...)는 milestone #0이 Paid가 되기 전에는 PREV_NOT_PAID로 실패합니다.

Reject 플로우:
 - reject(0, reasonURI) 후 submit(0, proofURI v2)

## 🗺 Roadmap

[x] Phase 1: Milestone Escrow Contract + Tests

[x] Phase 2: Minimal UI demo (Codespaces-compatible)

[x] Phase 3: Factory pattern (UI에서 새 escrow 생성, env 주소 교체 제거)

[x] Phase 4: Timeout / dispute window (N일 이후 claim)

[ ] Phase 5: Off-chain proof (IPFS + typed metadata)

[ ] Phase 6: Optional: testnet 배포 + wallet 기반 UX

<br/>
📬 Contact

Email: jaejin.kim0311@gmail.com
GitHub: github.com/jaejin0311
LinkedIn: linkedin.com/in/jaejink

<br/>

## 📝 Dev Log

2025-12-18: Supabase Integration & UX Polish
- **Feature:** Local JSON 캐싱 방식을 **Supabase(PostgreSQL)**로 전면 교체. 이제 배포된 에스크로 정보가 DB에 영구 저장됨.
- **Feature:** **Supabase Storage**를 연동하여 파일 업로드 기능 구현. (Proof Submission 시 파일 첨부 가능)
- **UX Improvement:** `Optimistic Update`(낙관적 업데이트) 적용. `fund()` 트랜잭션 후 채굴 대기 시간 동안 UI가 즉시 반응하도록 개선하여 사용성 증대.
- **UX Improvement:** 마일스톤 상세 뷰(Detail View) 구현. 상태별(Pending, Submitted, Approved)로 가능한 액션 버튼만 노출되도록 조건부 렌더링 고도화.
- **Refactoring:** 컴포넌트 분리(Atomic Design) 필요성 확인. `Home` 컴포넌트 비대화 문제를 해결하기 위해 리스트/상세 뷰 분리 계획 수립.

2025-12-14: UI 개선 (claim UX + 상태 메시지 + 선택/정렬 안정화)
- Added: claim 상태 안내 문구 (`submit first` / `ready in ...` / `ready`) 및 버튼 disable 조건 정리
- Added: 성공/에러 영역 분리 표시 (Success / Error)
- Improved: 체인 시간 기반 countdown 표시를 분 단위로 갱신 (불필요한 1초 리렌더 방지)
- Fixed: Factory escrow 리스트 정렬/선택 동작이 refresh 및 새 생성 시에도 일관되게 유지되도록 처리

2025-12-13: Sequential milestone enforcement 추가
 - Challenge: provider가 milestone #0을 건너뛰고 #1을 먼저 제출할 수 있었음
 - Solution: 컨트랙트에서 submit(i) 시 직전 마일스톤 Paid를 강제하고, 위반 시 PREV_NOT_PAID revert
 - Result: “단계별 검수/정산”이 프로토콜 레벨에서 보장됨

2025-12-13: Sepolia Factory 연동 + Escrow 목록 유지
 - Challenge: Alchemy Free tier의 eth_getLogs 스캔 범위 제한으로 과거 escrow 조회가 실패
 - Solution:
   - 최근 블록만 스캔
   - 생성된 escrow 주소를 .data/escrows.json에 저장하여 목록 유지
   - Next.js API route에서 .env.local을 직접 읽어 서버 환경변수 꼬임을 줄임
 - Result: Sepolia에서도 UI에서 escrow 생성/선택/상태조회가 안정적으로 동작

2025-12-13: Codespaces용 데모 안정화
 - Challenge: anvil RPC가 컨테이너 내부 127.0.0.1에 떠서 브라우저 지갑이 직접 접근 불가
 - Solution: Next.js API routes에서 서버가 트랜잭션 실행 (데모 전용)
 - Result: MetaMask 없이도 UI에서 fund → submit → approve/reject 플로우 실행 가능