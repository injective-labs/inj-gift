# InjGift App

Next.js frontend for the InjGift red-packet contract on Injective inEVM.

## Features

- Create red packets (random or equal distribution)
- Claim with password
- Packet detail page with status and share link
- Expiration refund flow (creator-only)

## Requirements

- Node.js 18+
- pnpm

## Environment Variables

Set these in `.env.local` for local dev, or in Vercel for deployment:

```
NEXT_PUBLIC_STACK_MODE=evm
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_EVM_CHAIN_ID=1439
NEXT_PUBLIC_EVM_RPC_URL=https://k8s.testnet.json-rpc.injective.network/
NEXT_PUBLIC_EVM_CONTRACT_ADDRESS=0x...
```

Optional (WalletConnect):

```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_ICON_URL=http://localhost:3000/favicon.ico
```

## Development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` in your browser.

## Build

```bash
pnpm build
```

## Deploy to Vercel

### One-Click Deploy

Click the button below to deploy this app to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/injective-pass-labs/inj_gift)

### Manual Deploy

1. **Install Vercel CLI** (if you haven't already):
   ```bash
   npm i -g vercel
   ```

2. **Navigate to the project root** and run:
   ```bash
   vercel
   ```

3. **Configure environment variables** in Vercel dashboard or via CLI:
   ```bash
   vercel env add NEXT_PUBLIC_STACK_MODE
   vercel env add NEXT_PUBLIC_NETWORK
   vercel env add NEXT_PUBLIC_LCD_ENDPOINT
   vercel env add NEXT_PUBLIC_RPC_ENDPOINT
   vercel env add NEXT_PUBLIC_CHAIN_ID
   vercel env add NEXT_PUBLIC_EVM_CHAIN_ID
   vercel env add NEXT_PUBLIC_EVM_RPC_URL
   vercel env add NEXT_PUBLIC_EVM_CONTRACT_ADDRESS
   ```

   Or set them directly in the Vercel dashboard under **Settings → Environment Variables**.

4. **Deploy**:
   ```bash
   vercel --prod
   ```

### Required Environment Variables

For testnet deployment, use these values:

```
NEXT_PUBLIC_STACK_MODE=evm
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_LCD_ENDPOINT=https://testnet.lcd.injective.network
NEXT_PUBLIC_RPC_ENDPOINT=https://testnet.rpc.injective.network
NEXT_PUBLIC_CHAIN_ID=injective-888
NEXT_PUBLIC_EVM_CHAIN_ID=1439
NEXT_PUBLIC_EVM_RPC_URL=https://k8s.testnet.json-rpc.injective.network/
NEXT_PUBLIC_EVM_CONTRACT_ADDRESS=0xfF2750Ac6f03d4fD4AA19D49a17DC4459cf2d6Ed
```

See `.env.example` for a complete list of all available environment variables.
