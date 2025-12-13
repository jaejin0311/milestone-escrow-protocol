.PHONY: test fmt lint

test:
	cd contracts && forge test -vvv

fmt:
	cd contracts && forge fmt

lint:
	cd apps/web && pnpm lint
