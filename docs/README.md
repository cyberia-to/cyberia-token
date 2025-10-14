# Cyberia (CAP) Token - Documentation

Complete documentation for the Cyberia governance token.

## 📚 Documentation Structure

### Getting Started

- **[Quick Start Guide](QUICK_START.md)** - Get up and running in minutes
- **[Development Guide](DEVELOPMENT.md)** - Development workflow, tooling, and testing

### Deployment & Operations

- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment procedures
- **[Governance Guide](GOVERNANCE.md)** - Tax management and DAO integration

### Integration Guides

- **[Aragon Integration](aragon-integration.md)** - Integrate with Aragon OSx DAO
- **[Safe Setup Guide](safe-setup-guide.md)** - Gnosis Safe + Zodiac configuration

### Technical Reference

- **[Smart Contract API](api/index.md)** - Auto-generated Solidity API documentation
- **[Foundry Testing](FOUNDRY.md)** - Fuzz testing with Foundry

### Main Repository

- **[README.md](../README.md)** - Project overview and quick reference

## 🏗️ Documentation Best Practices

This documentation follows industry best practices:

1. **Layered Approach**: From quick start to deep technical details
2. **Single Responsibility**: Each document has a clear, focused purpose
3. **Auto-Generated API**: Contract documentation is generated from NatSpec
4. **Practical Examples**: Real-world usage patterns and code snippets
5. **Up-to-Date**: Documentation lives with the code

## 📖 Recommended Reading Order

### For Developers

1. Quick Start Guide
2. Development Guide
3. Foundry Testing (optional)
4. Smart Contract API

### For Deployment/Ops

1. Quick Start Guide
2. Deployment Guide
3. Safe Setup Guide
4. Governance Guide

### For DAO Integration

1. Aragon Integration
2. Governance Guide
3. Smart Contract API (Admin Functions)

## 🔧 Generating Documentation

```bash
# Generate smart contract API documentation
npm run docgen

# Output: docs/api/index.md
```

The API documentation is automatically generated from Solidity NatSpec comments in the contract source code.

## 📝 Contributing to Documentation

When adding new features:

1. Update relevant documentation files
2. Add NatSpec comments to smart contracts
3. Regenerate API docs with `npm run docgen`
4. Test documentation examples

## 🔗 External Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Foundry Book](https://book.getfoundry.sh/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Aragon OSx Documentation](https://devs.aragon.org/)
- [Gnosis Safe Documentation](https://docs.safe.global/)

---

**Questions or Issues?** Open an issue on [GitHub](https://github.com/cyberia-to/cyberia-token/issues).
