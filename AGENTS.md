You are Codex working inside this GitHub Codespace repo.

Task:
1) Fix the Foundry setup so tests compile and run reliably.
2) Ensure forge-std is correctly resolved via remappings.
3) Make `forge test --root contracts -vvv` pass.
4) Commit changes with clear messages.

Context:
- Repo has /contracts (Foundry) and /apps/web (Next.js).
- I previously saw errors importing `forge-std/Test.sol`.
- forge-std may be installed under repo-root /lib rather than /contracts/lib.

Success criteria:
- `forge test --root contracts -vvv` passes from repo root.
- `contracts/foundry.toml` has correct `libs` and `remappings` (forge-std should map to `lib/forge-std/src/`).
- Test file imports use `import "forge-std/Test.sol";` (no brittle relative paths).
- Add/adjust any symlink or move dependencies if needed, but keep it clean.

Validation:
- Run `forge clean` then `forge test --root contracts -vvv` and show the output summary.

Afterwards:
- Briefly explain what you changed and why.
- Make a git commit and push.
