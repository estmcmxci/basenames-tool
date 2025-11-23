# Basenames Tool

A tool for registering and querying basenames (basetest.eth subdomains) on Base Sepolia.

## Project Structure

```
basenames-tool/
├── basenames-sepolia-registrar/  # Next.js UI application
│   └── README.md                 # UI-specific documentation
├── basename-scripts/             # TypeScript scripts for programmatic operations
└── README.md                     # This file
```

## Components

### 1. Basenames Sepolia Registrar UI (`basenames-sepolia-registrar/`)

A Next.js frontend application for registering and querying basenames. Fully static and IPFS-ready.

- **Features:** Register basenames, query existing records, check availability
- **Deployed:** https://v11.oakgroup.eth.link/
- **Tech Stack:** Next.js 14, React, viem, Tailwind CSS
- **See:** [basenames-sepolia-registrar/README.md](./basenames-sepolia-registrar/README.md) for detailed documentation

### 2. Basename Scripts (`basename-scripts/`)

TypeScript scripts for programmatic basename operations:

- `register-basename.ts` - Register basenames with address and text records
- `query-basenames.ts` - Query basename records
- `check-basename-available.ts` - Check if a basename is available

**Usage:** These scripts require a `.env.local` file with configuration (see below).

## Quick Start

### For UI Development

```bash
cd basenames-sepolia-registrar
npm install
npm run dev
```

### For Script Usage

1. Create `.env.local` in the root directory (see Environment Variables below)
2. Run scripts from the `basename-scripts/` directory

## Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Base Sepolia RPC URL (optional - defaults to https://sepolia.base.org)
BASE_RPC_URL=https://sepolia.base.org

# Basenames Contract Addresses (Base Sepolia)
BASENAMES_REGISTRY_BASE_SEPOLIA=0x1493b2567056c2181630115660963E13A8E32735
BASENAMES_BASE_REGISTRAR_BASE_SEPOLIA=0xa0c70ec36c010b55e3c434d6c6ebeec50c705794
BASENAMES_REGISTRAR_CONTROLLER_BASE_SEPOLIA=0x49ae3cc2e3aa768b1e5654f5d3c6002144a59581
BASENAMES_RESOLVER_BASE_SEPOLIA=0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA
BASENAMES_REVERSE_REGISTRAR_BASE_SEPOLIA=0x876eF94ce0773052a2f81921E70FF25a5e76841f

# Private Key (for scripts only - NEVER commit!)
CURATOR_PRIVATE_KEY=0x...
```

⚠️ **Never commit `.env.local`** - it's excluded via `.gitignore`.

## Contract Addresses (Base Sepolia)

- Registry: `0x1493b2567056c2181630115660963E13A8E32735`
- BaseRegistrar: `0xa0c70ec36c010b55e3c434d6c6ebeec50c705794`
- RegistrarController: `0x49ae3cc2e3aa768b1e5654f5d3c6002144a59581`
- Resolver: `0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA`
- ReverseRegistrar: `0x876eF94ce0773052a2f81921E70FF25a5e76841f`

## Security Notes

- All sensitive configuration uses environment variables
- `.gitignore` excludes sensitive files, build artifacts, and dependencies
- Never commit private keys, API keys, or `.env.local` files

## Development

### Building the UI

```bash
cd basenames-sepolia-registrar
npm run build
```

The static files will be in the `out/` directory, ready for IPFS deployment.

### IPFS Deployment

1. Build: `npm run build`
2. Upload the `out/` directory to IPFS
3. Update ENS records to point to the IPFS hash

## License

[Add your license here]

## Contributing

[Add contribution guidelines if needed]

