# Basenames on Base Sepolia UI

A simple frontend for registering and querying basenames (basetest.eth subdomains) on Base Sepolia.

## Features

- ✅ **Register Basenames** - Register new basenames with address and text records
- ✅ **Query Basenames** - Query existing basenames to see their records
- ✅ **Check Availability** - Check if a basename is available before registering

## Setup

1. Install dependencies:
```bash
npm install
```

2. (Optional) Create `.env.local` file for custom RPC URL:
```bash
NEXT_PUBLIC_BASE_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY
```

Note: The app includes a default working RPC URL, so `.env.local` is optional.

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Build for Static Export / IPFS Deployment

This app is fully client-side and compatible with IPFS deployment. To build:

```bash
npm run build
```

The static files will be in the `out/` directory, ready for IPFS deployment.

### IPFS Deployment Notes

- ✅ **Fully static**: No server-side code required - all components are client-side (`'use client'`)
- ✅ **Simple wallet connection**: Uses `window.ethereum` directly (MetaMask, Coinbase Wallet, etc.) - no heavy dependencies
- ✅ **RPC configuration**: Uses public RPC URLs (configure via `NEXT_PUBLIC_BASE_RPC_URL` env var)
- ✅ **Lightweight**: Only uses viem for blockchain interactions - no wagmi/rainbowkit/walletconnect complexity

### Deploy to IPFS

1. Build the static site:
   ```bash
   npm run build
   ```

2. Upload the `out/` directory to IPFS:
   ```bash
   # Using IPFS CLI
   ipfs add -r out/
   
   # Or use a service like Pinata, Fleek, or IPFS Deploy
   ```

3. Access via IPFS gateway:
   - Use any IPFS gateway: `https://gateway.pinata.cloud/ipfs/QmYourHash...`
   - Or use ENS + IPFS (set up DNS records pointing to IPFS hash)

### Architecture

- **Simple wallet connection**: Direct `window.ethereum` integration - works with MetaMask, Coinbase Wallet, and other EIP-1193 compatible wallets
- **Viem for blockchain**: Uses viem directly for all contract interactions (reads/writes)
- **No heavy dependencies**: Removed wagmi, RainbowKit, and WalletConnect for simplicity
- **IPFS ready**: Fully static export, works perfectly on IPFS

## Contract Addresses (Base Sepolia)

- Registry: `0x1493b2567056c2181630115660963E13A8E32735`
- BaseRegistrar: `0xa0c70ec36c010b55e3c434d6c6ebeec50c705794`
- RegistrarController: `0x49ae3cc2e3aa768b1e5654f5d3c6002144a59581`
- Resolver: `0x6533C94869D28fAA8dF77cc63f9e2b2D6Cf77eBA`
- ReverseRegistrar: `0x876eF94ce0773052a2f81921E70FF25a5e76841f`

## Notes

- Registration requires payment (varies by name length)
- Reverse records (Primary Name) require authorization and may fail if the caller is not authorized for the target address
- All operations are on Base Sepolia testnet
- Default RPC URL is configured and should work out of the box

