import { Router, Request, Response } from 'express';
import { generateTopics, generateHooks, generateBody, generateCTA } from '../services/ai-service';

const router = Router();

// ... imports

router.post('/api/generate', async (req: Request, res: Response) => {
    try {
        const { step, ...params } = req.body;
        console.log(`[API] Generate request - step: ${step}, model: ${params.model}`);

        // Extract grant auth params (optional)
        const grant = req.body.grantMessage ? {
            grantMessage: req.body.grantMessage,
            grantSignature: req.body.grantSignature,
            walletAddress: req.body.walletAddress
        } : undefined;

        if (grant) {
            console.log(`[API] Grant Auth received for wallet: ${grant.walletAddress}`);
        }

        let response;

        switch (step) {
            case 'topics':
                response = await generateTopics(params.input, params.researchDepth, params.model, grant);
                break;
            case 'hooks':
                response = await generateHooks(params.input, params.intent, params.model, grant);
                break;
            case 'body':
                response = await generateBody(params.input, params.context, params.intent, params.length, params.model, grant);
                break;
            case 'cta':
                response = await generateCTA(params.input, params.intent, params.model, grant);
                break;
            default:
                return res.status(400).json({ error: 'Invalid step' });
        }

        // Response structure is now { result: any, signature?: string }
        res.json(response);
    } catch (error) {
        console.error('Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate content' });
    }
});

export default router;
