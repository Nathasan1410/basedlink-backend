import fetch from 'node-fetch';

export async function fetchEigenGrantMessage(address: string): Promise<string> {
    const GRANT_API_URL = process.env.EIGEN_GRANT_API_URL || 'https://determinal-api.eigenarcade.com';

    console.log(`[AI Service] Fetching grant message for: ${address}`);

    const response = await fetch(`${GRANT_API_URL}/message?address=${address}`);

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Eigen API Error: ${error}`);
    }

    const message = await response.text();
    return message;
}
