/** @type {import('next').NextConfig} */
const path = require('path')
const fs = require('fs')

// Load environment variables from parent directory's .env.local
const parentEnvPath = path.join(__dirname, '..', '.env.local')
let parentEnv = {}

if (fs.existsSync(parentEnvPath)) {
  const envContent = fs.readFileSync(parentEnvPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim()
        // Remove quotes if present
        parentEnv[key.trim()] = value.replace(/^["']|["']$/g, '')
      }
    }
  })
}

// Map parent env vars to NEXT_PUBLIC_* for client-side access
// Use Base official public RPC endpoint (better browser compatibility than OnFinality)
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org'

const env = {
  // RPC URL - always use OnFinality directly
  NEXT_PUBLIC_BASE_RPC_URL: BASE_SEPOLIA_RPC,
  
  // Basenames contract addresses
  NEXT_PUBLIC_BASENAMES_REGISTRY_BASE_SEPOLIA: parentEnv.BASENAMES_REGISTRY_BASE_SEPOLIA || process.env.NEXT_PUBLIC_BASENAMES_REGISTRY_BASE_SEPOLIA,
  NEXT_PUBLIC_BASENAMES_BASE_REGISTRAR_BASE_SEPOLIA: parentEnv.BASENAMES_BASE_REGISTRAR_BASE_SEPOLIA || process.env.NEXT_PUBLIC_BASENAMES_BASE_REGISTRAR_BASE_SEPOLIA,
  NEXT_PUBLIC_BASENAMES_REGISTRAR_CONTROLLER_BASE_SEPOLIA: parentEnv.BASENAMES_REGISTRAR_CONTROLLER_BASE_SEPOLIA || process.env.NEXT_PUBLIC_BASENAMES_REGISTRAR_CONTROLLER_BASE_SEPOLIA,
  NEXT_PUBLIC_BASENAMES_RESOLVER_BASE_SEPOLIA: parentEnv.BASENAMES_RESOLVER_BASE_SEPOLIA || process.env.NEXT_PUBLIC_BASENAMES_RESOLVER_BASE_SEPOLIA,
  NEXT_PUBLIC_BASENAMES_REVERSE_REGISTRAR_BASE_SEPOLIA: parentEnv.BASENAMES_REVERSE_REGISTRAR_BASE_SEPOLIA || process.env.NEXT_PUBLIC_BASENAMES_REVERSE_REGISTRAR_BASE_SEPOLIA,
}

const nextConfig = {
  reactStrictMode: true,
  output: 'export', // Static export for IPFS deployment
  images: {
    unoptimized: true, // Required for static export
  },
  trailingSlash: true, // Better compatibility with IPFS gateways
  // Disable server-side features for IPFS compatibility
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
  env, // Expose env vars to client
  webpack: (config, { isServer }) => {
    // Ignore optional dependencies that cause warnings
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    }
    
    // Ignore these modules in webpack (they're optional dependencies)
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@react-native-async-storage/async-storage': false,
        'pino-pretty': false,
      }
    }
    
    return config
  },
}

module.exports = nextConfig

