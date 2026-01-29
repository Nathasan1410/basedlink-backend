import { ethers } from 'ethers';
// import axios from 'axios'; // Removed to avoid dependency error

// Config
const API_URL = 'http://127.0.0.1:4000/api/payment';
const CONTRACT_ADDRESS = '0xBA1510faD35f30F3c9ef0Dac121Fc507305FE413';
const CHAIN_ID = 84532; // Base Sepolia

async function main() {
    console.log("🚀 Starting Payment Flow Test...");

    // 1. Create a random user wallet
    const userWallet = ethers.Wallet.createRandom();
    console.log(`👤 Mock User Address: ${userWallet.address}`);

    // 2. Prepare Payment Data
    const tier = 1;
    const contentId = `test-${Date.now()}`;
    const nonce = 0; // Assuming new user
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    // 3. EIP-712 Domain & Types
    const domain = {
        name: "X402PaymentProcessor",
        version: "1",
        chainId: CHAIN_ID,
        verifyingContract: CONTRACT_ADDRESS
    };

    const types = {
        PaymentRequest: [
            { name: "user", type: "address" },
            { name: "tier", type: "uint256" },
            { name: "contentId", type: "string" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" }
        ]
    };

    const value = {
        user: userWallet.address,
        tier,
        contentId,
        nonce,
        deadline
    };

    // 4. Sign Data
    console.log("✍️  Signing EIP-712 Data...");
    const signature = await userWallet.signTypedData(domain, types, value);
    console.log(`📝 Signature: ${signature.substring(0, 20)}...`);

    // 5. Send to Backend
    console.log("📡 Sending to Backend...");
    try {
        const payload = {
            user: userWallet.address,
            tier,
            contentId,
            nonce,
            deadline,
            signature
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            console.log("\n✅ Test PASSED!");
            console.log("Response:", JSON.stringify(data, null, 2));
        } else {
            console.error("\n❌ Test FAILED (API Error)");
            console.error("Status:", response.status);
            console.error("Error:", data);
        }

    } catch (error: any) {
        console.error("\n❌ Test FAILED (Network/System Error)");
        console.error(error.message);
        if (error.cause) console.error(error.cause);
    }
}

main().catch(console.error);
