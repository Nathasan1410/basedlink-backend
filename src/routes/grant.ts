import { Router } from 'express';
import { fetchEigenGrantMessage } from '../services/grant-service';

const router = Router();

router.get('/api/grant/message', async (req, res) => {
    try {
        const { address } = req.query;

        if (!address || typeof address !== 'string') {
            return res.status(400).json({ error: 'Missing wallet address' });
        }

        const message = await fetchEigenGrantMessage(address);
        res.json({ message });
    } catch (error: any) {
        console.error('[Grant Route] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

export default router;
