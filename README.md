# Auto-Linkid Backend

Production-ready API backend for generating viral LinkedIn content with AI-powered insights and Web3 payment integration.

## Overview

This backend powers the Auto-Linkid platform, providing AI content generation, payment processing via USDC on Base Sepolia, and tiered content access based on user payments.

**Frontend Repository:** [Auto-Linkid/Frontend](https://github.com/Auto-Linkid/Frontend)

## Features

- **AI Content Generation**: Multi-step wizard for creating LinkedIn posts (topics, hooks, body, CTA)
- **Viral Content Analysis**: Real-time web research integration via Tavily API
- **Tiered Access**: Free and Premium content tiers based on USDC payments
- **Permissionless Payments**: Backend executes payments on behalf of users after approval
- **Model Selection**: Choose between quality (llama-3.3-70b) or speed (llama-3.1-8b)

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **AI Provider**: Groq SDK (llama models) + Eigen AI
- **Web Research**: Tavily API
- **Blockchain**: ethers.js for USDC payments on Base Sepolia
- **Server**: Express.js

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and configuration.

### Generate Content
```
POST /api/generate
Content-Type: application/json

{
  "step": "topics" | "hooks" | "body" | "cta",
  "input": "user input text",
  "context": { /* previous selections */ },
  "tier": 1 | 2,
  "model": "llama-3.3-70b-versatile" | "llama-3.1-8b-instant"
}
```

**Response:**
```json
{
  "result": "Generated content...",
  "signature": "0x..."
}
```

### Execute Payment
```
POST /api/execute-payment
Content-Type: application/json

{
  "userAddress": "0x...",
  "amount": "1000000"
}
```

Backend transfers USDC from user's wallet (requires prior approval) to backend wallet.

## Environment Variables

Create `.env` file in `AI-Backend/` directory:

```bash
# AI Providers
GROQ_API_KEY=gsk_...
EIGEN_AI_API_KEY=...

# Web Research
TAVILY_API_KEY=tvly-...

# Blockchain (Base Sepolia)
PRIVATE_KEY=0x...  # Backend wallet private key
USDC_CONTRACT_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
RPC_URL=https://sepolia.base.org
```

## Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start server
npm start

# Development mode (auto-reload)
npm run dev
```

Server runs on `http://localhost:3000`

## Deployment

Deployed on Render with automatic GitHub integration.

**Build Command:** `npm install && npm run build`  
**Start Command:** `npm start`

Ensure all environment variables are set in Render dashboard.

## Payment Flow

1. User approves backend wallet address for USDC spending (one-time)
2. Frontend calls `/api/execute-payment` with user address and amount
3. Backend executes `transferFrom()` to move USDC from user to backend
4. Transaction hash returned to frontend for verification

## License

Private repository for Auto-Linkid project.
