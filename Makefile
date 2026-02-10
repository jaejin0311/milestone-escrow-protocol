.PHONY: test fmt lint dev

test:
	cd contracts && forge test -vvv

fmt:
	cd contracts && forge fmt

lint:
	cd apps/web && pnpm lint

dev:
	cd apps/web && pnpm dev
