# 🚀 Milestone Escrow Protocol | Performance-based Escrow Demo (Foundry + Next.js)

![Foundry](https://img.shields.io/badge/Foundry-1.5.0-black?style=flat-square)
![Solidity](https://img.shields.io/badge/Solidity-0.8.20-green?style=flat-square&logo=solidity)
![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
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

### 2) Foundry Tests (Implemented)

- 해피패스 지급 검증
- Reject 후 resubmit 동작 검증
- 권한/순서 체크 (`NOT_PROVIDER`, `NOT_FUNDED` 등)

### 3) Codespaces-friendly Web Demo (Implemented)

Codespaces에서 `anvil`은 컨테이너 내부 `127.0.0.1`에 떠서, 로컬 브라우저 MetaMask가 직접 붙기 어렵습니다.  
그래서 이 데모는 다음 구조로 동작합니다.

- UI는 브라우저에서 열고
- 트랜잭션 실행은 **Next.js API Route 서버가** anvil RPC로 붙어서 처리

즉, **지갑 연결 없이도 버튼으로 fund/submit/approve/reject가 동작**합니다. (데모 목적)

> ⚠️ Security Note: 데모 전용입니다. `.env.local`에 private key가 들어갑니다.

### 4) Factory-based Escrow Creation (Implemented)

- `MilestoneEscrowFactory`를 Sepolia에 배포하고, UI에서 `createEscrow()`로 새 에스크로를 생성합니다.
- 생성된 에스크로 주소는 이벤트 로그 + 로컬 저장(.data)로 관리하여, Alchemy free tier의 로그 스캔 제한에도 데모가 동작합니다.


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
  ↓ fetch
Next.js (API routes) ──(JSON-RPC)──> RPC (Anvil or Sepolia)
  ↓
Factory → Escrow Contracts

⚠️ RPC Note (Alchemy Free tier): eth_getLogs는 최대 10 blocks range 제한이 있어, 본 데모는 최근 블록만 스캔하고 생성된 escrow 주소를 .data/escrows.json에 저장해 재사용합니다.
```

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
source .env

forge script script/DeployFactory.s.sol:DeployFactory \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --broadcast \
  --private-key "$DEPLOYER_PK" \
  -vv
```
출력의 Contract Address: 0x... (Factory Address)를 복사합니다.

### 3) Run Web UI
`apps/web/.env.local` 생성:
```bash
ESCROW_RPC_URL=http://127.0.0.1:8545
ESCROW_ADDRESS=0xYOUR_ESCROW_ADDRESS
```
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
<br/>

## ✅ Demo Flow
UI에서 순서대로:

fund() as CLIENT

submit(0, proofURI) as PROVIDER

approve(0) as CLIENT

milestone 1도 동일 반복

Reject 플로우:

reject(0, reasonURI) 후 submit(0, proofURI v2)

<br/>
## 📝 Dev Log


[x] Phase 1: Milestone Escrow Contract + Tests

[x] Phase 2: Minimal UI demo (Codespaces-compatible)

[x] Phase 3: Factory pattern (UI에서 새 escrow 생성, env 주소 교체 제거)

[ ] Phase 4: Timeout / dispute window (N일 이후 claim)

[ ] Phase 5: Off-chain proof (IPFS + typed metadata)

[ ] Phase 6: Optional: testnet 배포 + wallet 기반 UX

<br/>
📬 Contact

Email: jaejin.kim0311@gmail.com

GitHub: github.com/jaejin0311
LinkedIn: linkedin.com/in/jaejink

<br/>

## 📝 Dev Log

2025-12-13: Sepolia Factory 연동 + Escrow 목록 유지

Challenge: Alchemy Free tier의 `eth_getLogs`가 10 blocks range 제한으로 과거 escrow 조회가 실패
Solution:
- 최근 블록만 스캔
- 생성된 escrow 주소를 `.data/escrows.json`에 저장하여 목록 유지
- Next.js API route에서 `.env.local`을 직접 읽어 PK/설정값이 서버 환경변수에 의해 꼬이지 않도록 안정화
Result: Sepolia에서도 UI에서 escrow 생성/선택/상태조회가 안정적으로 동작

2025-12-13 (Latest): Codespaces용 데모 안정화
Challenge: anvil RPC가 컨테이너 내부 127.0.0.1에 떠서 브라우저 지갑이 직접 접근 불가
Solution: Next.js API routes에서 서버가 트랜잭션 실행 (데모 전용)
Result: MetaMask 없이도 UI에서 fund → submit → approve/reject 플로우 실행 가능

2025-12-13: Foundry 테스트/의존성 이슈 복구
forge-std 의존성/경로 문제 해결
stateless 환경(Codespaces)에서 재현 가능한 셋업 정리