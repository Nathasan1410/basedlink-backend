import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';

const router = Router();

// Environment variables
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL;
const PRIVATE_KEY = process.env.FACILITATOR_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.PAYMENT_CONTRACT_ADDRESS;

if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
    console.warn("⚠️  Missing Payment Config in .env");
}

// Contract ABI (Minimal)
const ABI = [
    "function verifyPaymentSignature(address user, uint256 tier, string contentId, uint256 nonce, uint256 deadline, bytes signature) view returns (bool, string)",
    "function executePayment(address user, uint256 tier, string contentId, uint256 nonce, uint256 deadline, bytes signature) returns (bool)",
    "function getTierPrice(uint256 tier) view returns (uint256)"
];

router.post('/api/payment', async (req: Request, res: Response) => {
    try {
        const { user, tier, contentId, nonce, deadline, signature } = req.body;

        if (!user || !tier || !contentId || nonce === undefined || !deadline || !signature) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        console.log(`[Payment] Processing for user ${user}, tier ${tier}`);

        // Setup Ethers
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY!, provider);
        const contract = new ethers.Contract(CONTRACT_ADDRESS!, ABI, wallet);

        // 1. Verify Signature (Read-only call to contract)
        // This is crucial to check BEFORE paying gas for execution
        try {
            const [isValid, reason] = await contract.verifyPaymentSignature(
                user,
                tier,
                contentId,
                nonce,
                deadline,
                signature
            );

            if (!isValid) {
                console.warn(`[Payment] Invalid Signature: ${reason}`);
                return res.status(402).json({ success: false, error: reason });
            }
        } catch (err: any) {
            // Handle revert or contract error during verification
            console.error("[Payment] Verification Error:", err.message);
            return res.status(500).json({ success: false, error: 'Contract verification failed' });
        }

        // 2. Execute Payment (On-chain Transaction)
        console.log(`[Payment] Executing transaction...`);
        let tx;
        try {
            tx = await contract.executePayment(
                user,
                tier,
                contentId,
                nonce,
                deadline,
                signature
            );
            console.log(`[Payment] Tx Sent: ${tx.hash}`);
        } catch (err: any) {
            console.error("[Payment] Execution Error:", err.message);
            // Provide more specific error if possible
            return res.status(500).json({ success: false, error: 'Transaction execution failed' });
        }

        // 3. Wait for Confirmation
        const receipt = await tx.wait();
        if (receipt.status !== 1) {
            return res.status(500).json({ success: false, error: 'Transaction reverted' });
        }
        console.log(`[Payment] Tx Confirmed: ${receipt.hash}`);

        // 4. Trigger AI Generation directly
        // In a real app, this might be a separate event or queue
        // For now, we return success and let the frontend call the AI endpoints, 
        // OR we can generate here and return it.
        // User requested: "Flow: Payment Success -> Get tier info -> Call AI Service -> Return result"

        // Import dynamically to avoid circular deps if needed, or structured logic
        const { generateTieredContent } = await import('../services/ai-service');
        const aiResult = await generateTieredContent(tier, contentId); // We need to implement this

        return res.json({
            success: true,
            txHash: receipt.hash,
            result: aiResult
        });

    } catch (error: any) {
        console.error('[Payment] Endpoint Error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// --- New Route: execute-payment (Permissionless Mode) ---
router.post('/api/execute-payment', async (req: Request, res: Response) => {
    try {
        const { userAddress, tier } = req.body;

        if (!userAddress || !tier) {
            return res.status(400).json({ success: false, error: 'Missing userAddress or tier' });
        }

        console.log(`[Payment] Execute (Permissionless) for ${userAddress}, tier ${tier}`);

        // Config
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY!, provider); // Facilitator/Paymaster Wallet

        console.log(`[Payment] Facilitator Address: ${wallet.address}`); // Verify this matches frontend BACKEND_WALLET

        // Constants (should match frontend)
        const MOCK_USDC_ADDRESS = '0xfD96ABdF9acb7Cde74D9DaC2D469d7717A80ee56';
        const TIERS: Record<number, bigint> = {
            1: 5_000_000n,    // $5
            2: 15_000_000n,   // $15
            3: 30_000_000n    // $30
        };
        const amount = TIERS[Number(tier)];

        if (!amount) {
            return res.status(400).json({ success: false, error: 'Invalid tier' });
        }

        const usdcAbi = [
            "function allowance(address owner, address spender) view returns (uint256)",
            "function balanceOf(address account) view returns (uint256)",
            "function transferFrom(address from, address to, uint256 amount) returns (bool)"
        ];
        const usdcContract = new ethers.Contract(MOCK_USDC_ADDRESS, usdcAbi, wallet);

        // 1. Check Allowance
        // userAddress must have approved wallet.address
        const allowance = await usdcContract.allowance(userAddress, wallet.address);
        if (allowance < amount) {
            console.warn(`[Payment] Insufficient allowance: ${allowance.toString()} < ${amount.toString()}`);
            return res.status(400).json({
                success: false,
                error: 'Insufficient USDC allowance. Please enable permissionless mode first.',
                needsApproval: true
            });
        }

        // 2. Check Balance
        const balance = await usdcContract.balanceOf(userAddress);
        if (balance < amount) {
            return res.status(400).json({ success: false, error: 'Insufficient USDC balance' });
        }

        // 3. Execute TransferFrom
        console.log(`[Payment] Executing transferFrom...`);
        const tx = await usdcContract.transferFrom(userAddress, wallet.address, amount);
        console.log(`[Payment] Tx Sent: ${tx.hash}`);

        const receipt = await tx.wait();
        if (receipt.status !== 1) {
            throw new Error('Transaction reverted');
        }
        console.log(`[Payment] Tx Confirmed: ${receipt.hash}`);

        // 4. Generate Content (or mock for now)
        const contentId = `linkid-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

        // Return success
        return res.json({
            success: true,
            contentId,
            txHash: receipt.hash,
            content: {
                tier,
                title: 'AI Generated Content',
                content: 'Content generation triggered successfully via permissionless flow.'
            }
        });

    } catch (error: any) {
        console.error('[Payment] Execute Error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Execution failed' });
    }
});

export default router;
