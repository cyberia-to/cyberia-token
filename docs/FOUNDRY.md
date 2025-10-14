# Foundry Integration for Fuzz Testing

This project uses a hybrid Hardhat + Foundry setup to leverage the best of both tools:

- **Hardhat**: TypeScript integration, deployment scripts, and comprehensive testing
- **Foundry**: Fast fuzz testing, invariant testing, and gas optimization

## Installation

### macOS/Linux

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Windows

Download from: https://github.com/foundry-rs/foundry/releases

Verify installation:

```bash
forge --version
```

## Quick Start

### Using NPM Scripts (Recommended)

```bash
# Run all Foundry tests
npm run test:foundry

# Run specific test suites
npm run test:foundry:fuzz         # Fuzz tests only
npm run test:foundry:invariant    # Invariant tests only
npm run test:foundry:stateful     # Stateful tests only

# Additional options
npm run test:foundry:coverage     # Generate coverage
npm run test:foundry:gas          # Generate gas report
```

### Using Forge Directly

```bash
# Install dependencies (if needed)
forge install foundry-rs/forge-std --no-commit

# Run all tests
forge test

# Run with verbosity
forge test -vvv

# Run specific test file
forge test --match-path test/foundry/CAPToken.fuzz.t.sol

# Run specific test function
forge test --match-test testFuzz_TransferNeverExceedsBalance

# Run with gas report
forge test --gas-report
```

## Project Structure

```
test/foundry/                    # Foundry test suite
├── CAPToken.fuzz.t.sol         # Fuzz tests (random inputs)
├── CAPToken.invariant.t.sol    # Invariant tests (properties that always hold)
└── CAPToken.stateful.t.sol     # Stateful tests (complex multi-step scenarios)
foundry.toml                     # Foundry configuration
```

## Fuzz Testing Configuration

The project is configured in `foundry.toml`:

- **Fuzz runs**: 256 (adjustable for more thorough testing)
- **Invariant runs**: 256
- **Solc version**: 0.8.24 (matches Hardhat)
- **Optimizer**: Enabled with 200 runs

## Writing Fuzz Tests

Fuzz tests accept random inputs from Foundry's fuzzer:

```solidity
function testFuzz_TransferNeverExceedsBalance(address to, uint256 amount) public {
  vm.assume(to != address(0)); // Filter invalid inputs
  vm.assume(amount > 0);

  // Your test logic here
}
```

### Best Practices

1. **Use `vm.assume()`** to filter invalid inputs
2. **Test invariants** (properties that should always hold)
3. **Test boundaries** (min/max values, edge cases)
4. **Check state consistency** (balances, supply, etc.)

## Available Fuzz Tests

### `testFuzz_TransferNeverExceedsBalance`

Ensures transfers never exceed the sender's balance.

### `testFuzz_TotalSupplyConsistency`

Verifies total supply remains constant through transfers.

### `testFuzz_AllowanceMechanism`

Tests the approve/transferFrom mechanism with random values.

### `testFuzz_FeeCalculationNoOverflow`

Ensures fee calculations don't cause overflows.

### `testFuzz_BalanceSumEqualsSupply`

Invariant test: sum of all balances equals total supply.

## Running Both Test Suites

```bash
# Run Hardhat tests
npm test

# Run Foundry fuzz tests
forge test

# Run both in CI
npm test && forge test
```

## Integration with CI/CD

✅ **Foundry tests are now integrated into the CI/CD pipeline!**

The `.github/workflows/ci.yml` includes a dedicated Foundry job that:

- Installs Foundry automatically
- Runs all Foundry test suites (fuzz, invariant, stateful)
- Generates gas reports
- Runs in parallel with Hardhat tests

The CI pipeline runs Foundry tests on every:

- Push to `main` or `develop` branches
- Pull request to `main` or `develop` branches

### Manual CI Testing

You can view Foundry test results in the GitHub Actions "Foundry Tests" job.

## Useful Commands

```bash
# Clean build artifacts
forge clean

# Check contract sizes
forge build --sizes

# Generate coverage report
forge coverage

# Create snapshot (for gas benchmarking)
forge snapshot

# Format Solidity code
forge fmt
```

## Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [Fuzz Testing Guide](https://book.getfoundry.sh/forge/fuzz-testing)
- [Invariant Testing](https://book.getfoundry.sh/forge/invariant-testing)
- [Cheatcodes Reference](https://book.getfoundry.sh/cheatcodes/)

## Troubleshooting

### Issue: "forge: command not found"

**Solution**: Run `foundryup` or add Foundry to your PATH

### Issue: Compilation errors with OpenZeppelin

**Solution**: Ensure `node_modules` is in the `libs` array in `foundry.toml`

### Issue: Tests pass in Hardhat but fail in Foundry

**Solution**: Check for differences in EVM behavior or missing setup in `setUp()`
