import dotenv from 'dotenv';
dotenv.config(); // Load env BEFORE other imports

import express from 'express';
import cors from 'cors';
import generateRouter from './routes/generate';
import polishRouter from './routes/polish';
import paymentRouter from './routes/payment';
import grantRouter from './routes/grant';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://frontend-zeta-smoky-96.vercel.app',
        'https://basedlink.vercel.app',
        process.env.CORS_ORIGIN || ''
    ].filter(Boolean),
    credentials: true
}));
app.use(express.json());

// Routes
app.use(generateRouter);
app.use(polishRouter);
app.use(paymentRouter);
app.use(grantRouter);

// Faucet Route (Manual Nonce Fix)
import { ethers } from 'ethers';
app.post('/api/faucet', async (req, res) => {
    try {
        const { userAddress } = req.body;
        if (!userAddress) return res.status(400).json({ error: 'Missing userAddress' });

        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://sepolia.base.org');
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY as string, provider);

        console.log(`💧 Faucet request for: ${userAddress}`);

        // 1. Force fetch latest nonce (pending) to avoid "replacement transaction underpriced"
        const nonce = await provider.getTransactionCount(wallet.address, 'pending');

        // 2. MockUSDC Contract (Transfer 100 USDC)
        const amount = ethers.parseUnits('100', 6); // USDC is 6 decimals
        const contract = new ethers.Contract(
            process.env.MOCK_USDC_ADDRESS || '0xfD96ABdF9acb7Cde74D9DaC2D469d7717A80ee56',
            ['function transfer(address to, uint256 amount) returns (bool)'],
            wallet
        );

        // 3. Send Transaction with aggressive gas settings to prevent stale issues
        const tx = await contract.transfer(userAddress, amount, {
            nonce: nonce,
            // gasLimit: 100000 // Optional, let it estimate
        });

        console.log(`✅ Faucet TX sent: ${tx.hash}`);
        await tx.wait(); // Wait for confirmation

        res.json({ success: true, txHash: tx.hash });
    } catch (error: any) {
        console.error('❌ Faucet error:', error);
        res.status(500).json({ error: error.message || 'Faucet failed' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'AI Backend is running' });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 AI Backend running on http://localhost:${PORT}`);
    console.log(`📡 CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
});
