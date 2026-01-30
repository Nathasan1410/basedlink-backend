import OpenAI from 'openai';
import { tavily } from '@tavily/core';
import dotenv from 'dotenv';
import path from 'path'; // Added path
import viralPosts from '../data/viral_posts.json';

// Load environment variables robustly
const envPath = path.resolve(__dirname, '../../.env');
console.log('[AI Service] Loading .env from:', envPath);
dotenv.config({ path: envPath });

// Debug Log
const eigenKey = process.env.EIGEN_API_KEY || '';
const eigenUrl = process.env.EIGEN_BASE_URL || 'https://eigenai-sepolia.eigencloud.xyz/v1';
const groqKey = process.env.GROQ_API_KEY || '';

console.log(`[AI Service] Eigen Config: BaseURL=${eigenUrl}`);
console.log(`[AI Service] Eigen API Key=${eigenKey ? eigenKey.substring(0, 8) + '...' : 'MISSING'}`);
console.log(`[AI Service] Groq API Key=${groqKey ? groqKey.substring(0, 8) + '...' : 'MISSING'}`);

// Initialize Clients
// Eigen AI (Primary)
const eigenAI = new OpenAI({
    apiKey: eigenKey || 'placeholder',
    baseURL: eigenUrl,
});

// Groq (Fallback)
const groqAI = new OpenAI({
    apiKey: groqKey,
    baseURL: 'https://api.groq.com/openai/v1',
});

// Smart Client Selector with Fallback
// Smart Client Selector (Forced to Groq for Simulated Demo)
let openai = groqAI;
let isUsingGroq = true;

const switchToGroq = () => {
    // Already using Groq
};

// Helper: Call Eigen AI with Grant-based Auth
const callEigenGrantAPI = async (messages: any[], model: string, grant?: GrantAuth): Promise<any> => {
    const GRANT_API_URL = process.env.EIGEN_GRANT_API_URL || 'https://determinal-api.eigenarcade.com';

    if (!grant) {
        throw new Error('Grant authentication required for Eigen AI');
    }

    const response = await fetch(`${GRANT_API_URL}/api/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            messages,
            model,
            max_tokens: 2500,
            seed: 42,
            grantMessage: grant.grantMessage,
            grantSignature: grant.grantSignature,
            walletAddress: grant.walletAddress,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Eigen Grant API error: ${error}`);
    }

    return await response.json();
};

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY || '' });
const EIGEN_MODEL = process.env.EIGEN_MODEL || 'gpt-oss-120b-f16';
const GROQ_MODEL = 'llama-3.3-70b-versatile'; // Groq's best model
const MODEL_NAME = isUsingGroq ? GROQ_MODEL : EIGEN_MODEL;

// Types
export interface GenerateOptions {
    input?: string;
    context?: string;
    intent?: string;
    length?: string;
    tone?: number;
    emojiDensity?: number;
    language?: string;
    researchDepth?: number;
    model?: string;
}

export interface AIResponse<T> {
    result: T;
    signature?: string;
}

export interface GrantAuth {
    grantMessage: string;
    grantSignature: string;
    walletAddress: string;
}

// Helper: Resolve Model ID from UI Name
const resolveModelId = (modelName?: string): string => {
    // If using Groq fallback, return Groq model
    if (isUsingGroq) return GROQ_MODEL;

    // Default
    if (!modelName) return EIGEN_MODEL;

    // Normalization
    const name = modelName.toLowerCase();

    if (name.includes('gpt-oss') || name.includes('eigen')) {
        return 'gpt-oss-120b-f16';
    }
    if (name.includes('qwen')) {
        return 'meta-llama-3-1-8b-instruct-q3'; // Best fallback for now
    }

    return EIGEN_MODEL;
};

// Helper: Robust JSON Cleaner & Parser with Fallback
const cleanAndParseJSON = (text: string): any => {
    console.log('[AI Clean] Raw:', text.substring(0, 50) + '...');

    // 1. Clean markdown code blocks
    let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    // 2. Try Regex Extraction of Array [ ... ]
    const arrayMatch = cleaned.match(/\[([\s\S]*?)\]/);
    if (arrayMatch) {
        try {
            const parsed = JSON.parse(arrayMatch[0]);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) { console.log('Regex JSON failed'); }
    }

    // 3. Fallback: Split by lines (if AI gave a list)
    const lines = text.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 10)
        .filter(l => !l.toLowerCase().includes('here are'))
        .filter(l => !l.startsWith('['))
        .filter(l => !l.startsWith(']'))
        .map(l => l.replace(/^\d+[\.\)]\s*/, '')) // Remove "1. ", "2. "
        .map(l => l.replace(/^["']|["']$/g, '')) // Remove quotes
        .map(l => l.replace(/,$/, '')); // Remove trailing comma

    if (lines.length > 0) return lines;

    return []; // Return empty only if totally failed
};

// --- Helpers from "Highly Modelled" Logic ---

// Helper: Get tone/voice instruction based on slider value (0-10)
export const getToneInstruction = (toneValue: number = 5): string => {
    // 0-3: Authoritative (Analytical & Insightful)
    if (toneValue <= 3) {
        return `
**TONE: AUTHORITATIVE & ANALYTICAL**
- Use professional, formal language
- Structure: Numbered lists (1️⃣, 2️⃣, 3️⃣)
- Include frameworks/concepts (e.g., "Atomic Habits", "Law of Least Effort")
- Longer, more detailed explanations
- Vocabulary: "Saya menyimpulkan", "fenomena ini terjadi", "observasi", "refleksi"
- Avoid casual slang ("aku", "banget", "gak")
- End with thought-provoking question
- Example: "Apakah teman-teman setuju dengan observasi ini?"
        `.trim();
    }

    // 4-6: Balanced (Mix of both)
    if (toneValue <= 6) {
        return `
**TONE: BALANCED (PROFESSIONAL YET APPROACHABLE)**
- Mix formal and casual language
- Structure: Mix of numbered lists and emoji bullets
- Moderate detail level
- Vocabulary: Mix "saya" and "aku", professional but not stiff
- Some emojis (1-2 max)
- Example: "Menurut saya, ada 3 alasan utama..."
        `.trim();
    }

    // 7-10: Social (Relatable & Conversational)
    return `
**TONE: SOCIAL & CONVERSATIONAL (CLOSE FRIEND)**
- Use casual, everyday language
- Structure: Emoji bullets (✅, 🎯, 💡)
- Shorter, punchier sentences
- Vocabulary: "aku", "banget", "gak", "gimana", "relate"
- Lots of emojis (2-3 per section)
- Personal anecdotes: "Jujur aku...", "Ada yang relate?"
- Rhetorical questions: "Gimana menurut kalian?"
- Example: "Niatnya cuma login sebentar, sadar-sadar sudah 4 jam. Ada yang relate? 😅"
    `.trim();
};

// Helper: Get emoji usage instruction based on user preference
export const getEmojiInstruction = (emojiLevel: string | number = 'moderate'): string => {
    // Convert number (0-10) to string category
    let level: string;
    if (typeof emojiLevel === 'number') {
        if (emojiLevel <= 2) level = 'none';
        else if (emojiLevel <= 4) level = 'minimal';
        else if (emojiLevel <= 7) level = 'moderate';
        else level = 'rich';
    } else {
        level = emojiLevel;
    }

    switch (level) {
        case 'none':
            return `
**EMOJI USAGE: NONE (SERIOUS/PROFESSIONAL)**
- **CRITICAL**: Do NOT use ANY emojis at all
- No emoji bullets, no emoji in text, no emoji anywhere
- This is for professional/corporate tone or to avoid AI detection
- Use plain text bullets: "•" or "-" or numbered lists
            `.trim();

        case 'minimal':
            return `
**EMOJI USAGE: MINIMAL (SUBTLE)**
- Use ONLY 1-2 emojis in the ENTIRE post
- Place at the very end as a closing touch (e.g., "Thoughts? 💭")
- OR use one emoji in the hook only
- Avoid emoji bullets
- Keep it very subtle and professional
            `.trim();

        case 'moderate':
            return `
**EMOJI USAGE: MODERATE (BALANCED)**
- Use 3-5 emojis total
- Can use emoji bullets for lists (✅, 🎯, 💡)
- 1-2 emojis in body text for emphasis
- Avoid overuse - keep it tasteful
- Example: "3 reasons: ✅ Access ✅ Convenience ✅ Instant"
            `.trim();

        case 'rich':
            return `
**EMOJI USAGE: RICH (VERY LIVELY)**
- Use 5+ emojis throughout the post
- Emoji bullets for all list items
- Emojis in hook, body, and CTA
- Make it visually engaging and fun
- Example: "Niatnya cuma login sebentar 📱, sadar-sadar sudah 4 jam ⏰. Ada yang relate? 😅"
            `.trim();

        default:
            return getEmojiInstruction('moderate');
    }
};

// Helper: Get language instruction based on user preference
export const getLanguageInstruction = (language: string = 'id'): string => {
    switch (language) {
        case 'en':
            return `
**LANGUAGE: ENGLISH**
- Write the ENTIRE post in English
- Use English vocabulary, grammar, and idioms
- Examples: "I used to think...", "Here's why...", "Thoughts?"
- Do NOT mix Indonesian words
            `.trim();

        case 'id':
            return `
**LANGUAGE: INDONESIAN (BAHASA INDONESIA)**
- Write the ENTIRE post in Bahasa Indonesia
- Use Indonesian vocabulary, grammar, and expressions
- **CRITICAL EXCEPTION**: Keep these in ENGLISH (do NOT translate):
  * English idioms: "Unpopular opinion", "game-changer", "mindset", "plot twist"
  * Technical terms: "AI", "machine learning", "blockchain", "SaaS"
  * Brand names: "Korean BBQ", "Bulgogi", "LinkedIn", "ChatGPT"
  * Proper nouns: Names of people, places, products
  - Examples:
  * ✅ "Unpopular opinion: Aku dulu mikir bahwa..."
  * ✅ "Ini adalah game-changer untuk bisnis kita"
            `.trim();

        default:
            return getLanguageInstruction('id');
    }
};

// Helper: Get Random Viral Posts for Context
const getViralContext = (count = 2, intent = 'viral', length = 'medium') => {
    let pool = viralPosts.filter((p: any) =>
        (!intent || p.intent === intent) &&
        (!length || p.length === length)
    );
    if (pool.length === 0) pool = viralPosts.filter((p: any) => !length || p.length === length);
    if (pool.length === 0) pool = viralPosts.filter((p: any) => !intent || p.intent === intent);
    if (pool.length === 0) pool = viralPosts;

    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
};


// --- Core Functions ---

// 1. Generate Topics
export async function generateTopics(input: string, depth: number = 3, model?: string, grant?: GrantAuth): Promise<AIResponse<string[]>> {
    const prompt = `
    Generate exactly 10 distinct, viral-worthy LinkedIn post topics based on the user's input: "${input}".
    
    REQUIREMENTS:
    - Focus on professional insights, personal growth, or industry trends
    - Each topic should be unique and engaging
    - Make them scroll-stopping and curiosity-inducing
    - Keep each topic concise (1-2 sentences max)
    
    OUTPUT FORMAT:
    - STRICT JSON ARRAY ONLY containing 10 strings.
    - DO NOT include "Here are...", "Below are...", or any intro text.
    - Start immediately with [.
    - End immediately with ].
    
    Example: ["Topic 1", "Topic 2", "Topic 3", "Topic 4", "Topic 5", "Topic 6", "Topic 7", "Topic 8", "Topic 9", "Topic 10"]
    `;

    try {
        // SIMULATED DEMO: Bypass Eigen AI even if grant is present
        // if (grant) { ... } -> Skipped for better quality via Groq
        if (grant) {
            console.log('[AI Service] Grant auth received, but forcing Groq for Simulated Demo');
        }

        // Fallback to standard OpenAI client (Groq)
        const completion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: prompt }],
            model: resolveModelId(model),
            temperature: 0.8,
            max_tokens: 2500,
        });

        const content = completion.choices[0]?.message?.content || '[]';
        const result = cleanAndParseJSON(content);
        const signature = (completion as any).signature;

        return { result, signature };
    } catch (e: any) {
        console.error("AI Error (Topics):", e?.message || e);

        // If Eigen Grant fails, fallback to Groq
        if (grant && !isUsingGroq) {
            console.log('[AI Service] Eigen Grant failed, falling back to Groq');
            switchToGroq();
            return generateTopics(input, depth, model); // Retry without grant
        }

        // If authentication error and not using Groq yet, switch and retry
        if (!isUsingGroq && e?.status === 401) {
            switchToGroq();
            return generateTopics(input, depth, model);
        }

        return { result: [input] };
    }
}

// 2. Generate Hooks
export async function generateHooks(topic: string, intent: string = 'viral', model?: string, grant?: GrantAuth): Promise<AIResponse<string[]>> {
    const prompt = `
    You are a LinkedIn Viral Content Expert. Write 8 powerful, scroll-stopping hooks for the topic: "${topic}".
    
    Intent: ${intent.toUpperCase()}
    
    HOOK WRITING RULES:
    1. **First Line is CRITICAL** - Must stop the scroll immediately
    2. **Pattern Breaking** - Use unexpected angles, contrarian takes, or surprising facts
    3. **Curiosity Gap** - Make readers NEED to know more
    4. **Emotional Trigger** - Fear of missing out, surprise, anger, joy, inspiration
    5. **Specific > Generic** - Use numbers, names, concrete examples
    
    PROVEN HOOK FORMULAS:
    - "I spent [X time/money] on [Y]. Here's what I learned..."
    - "Everyone does [X]. Here's why you should do [Y] instead..."
    - "Unpopular opinion: [controversial take]"
    - "[Number] [surprising thing] that [result]"
    - "I used to [belief]. Then I discovered [truth]..."
    - "The biggest lie about [topic]: [statement]"
    
    LANGUAGE:
    - Use Bahasa Indonesia naturally
    - Keep English idioms/technical terms (e.g., "game-changer", "mindset", "AI")
    - Conversational and authentic tone
    
    OUTPUT FORMAT:
    - STRICT JSON ARRAY ONLY.
    - NO Markdown code blocks (no \`\`\`json).
    - NO introductory text.
    - Start with [. End with ].
    // Get viral context for few-shot learning
    const viralContext = getViralContext(3, intent).map(p => `- "${p.hook}"`).join('\n');

    const viralPrompt = `
    You are a LinkedIn Viral Content Expert.
        Topic: "${topic}"
    Intent: ${ intent.toUpperCase() }
    
    Analyze these REAL VIRAL HOOKS from our database:
    ${ viralContext }

    TASK: Write 8 NEW powerful hooks for the topic above. 
    Mimic the style, punchiness, and psychological triggers of the examples provided.
    
    HOOK RULES:
    1. ** NO Generic Openers ** (Avoid: "In today's fast world...")
    2. ** Pattern Interruption ** (Start with a number, a bold statement, or a question)
    3. ** Specifics ** (Use brackets[Number], [Time], [Result] where users can fill in blanks)
    
    OUTPUT FORMAT:
    - Pure plain text.
    - Separate each hook with "|||".
    - NO Numbering.NO Intro.
    - Example: Hook 1... ||| Hook 2... ||| Hook 3...
    `;

    try {
        console.log(`[AI Hook] Generating with viral context length: ${ viralContext.length } `);

        // Try Eigen AI with Grant first if grant provided
        if (grant) {
            const response = await callEigenGrantAPI(
                [{ role: 'user', content: viralPrompt }],
                resolveModelId(model),
                grant
            );
            const content = response.choices[0]?.message?.content || '';
            const result = content.split('|||').map(h => h.trim()).filter(h => h.length > 5);
            return { result, signature: response.signature };
        }

        const completion = await openai.chat.completions.create({
            messages: [{ role: 'user', content: viralPrompt }],
            model: resolveModelId(model),
            temperature: 0.9,
            max_tokens: 2500,
        });

        const content = completion.choices[0]?.message?.content || '';
        const result = content.split('|||').map(h => h.trim()).filter(h => h.length > 5);

        return { result, signature: (completion as any).signature };
    } catch (e: any) {
        console.error("AI Error (Hooks):", e?.message || e);
        if (grant && !isUsingGroq) { switchToGroq(); return generateHooks(topic, intent, model); }
        if (!isUsingGroq && e?.status === 401) { switchToGroq(); return generateHooks(topic, intent, model); }
        return { result: [`${ topic } is important because...`] };
    }
}

// 3. Generate Body (Array of variations) - THE ROBUST VERSION
export async function generateBody(hook: string, context: string, intent: string, length: string, model?: string, grant?: GrantAuth): Promise<AIResponse<string[]>> {

        // A. Research Layer (Content)
        let researchContext = '';
        try {
            const search = await tvly.search(context || hook, { maxResults: 2 });
            researchContext = search.results.map((r: any) => `- ${ r.title }: ${ r.content } `).join('\n');
        } catch (e) { console.log('Research failed', e); }

        const prompt = `
    You are a LinkedIn Ghostwriter.Expert at viral content.

        Topic: "${context}"
    Hook: "${hook}"

    Goal: Write 4 DIFFERENT variations of tags formatted as LinkedIn post bodies.
    
    OUTPUT FORMAT:
    - Pure plain text.
    - Separate each variation with "|||".
    - No JSON.
    - No intro text.
    - Use double newlines for paragraphs.

        Example:
    Variation 1 text... ||| Variation 2 text... ||| Variation 3 text... ||| Variation 4 text...
    `;

        try {
            const completion = await openai.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: resolveModelId(model),
                temperature: 0.85,
                max_tokens: 3500,
            });

            const content = completion.choices[0]?.message?.content || '';

            let bodies = content.split('|||').map(b => b.trim()).filter(b => b.length > 10);
            if (bodies.length === 0) bodies = [content];

            const signature = "0xSIMULATED_DEMO_SIGNATURE_BY_GROQ";

            return { result: bodies, signature };
        } catch (error: any) {
            console.error('[AI Body] Error:', error?.message || error);
            return { result: ["Error generating body. Please try again."] };
        }
    }


    // 4. Generate CTA (Enriched with Viral Data)
    export async function generateCTA(body: string, intent: string, model?: string, grant?: GrantAuth): Promise<AIResponse<string[]>> {
        const prompt = `
    You are a LinkedIn engagement expert.Generate 4 compelling Call - To - Actions(CTAs) for a LinkedIn post.
    
    Post Body Context: "${body.substring(0, 150)}..."
    Intent: ${ intent.toUpperCase() }
    
    CTA RULES:
    1. ** Keep it SHORT ** - Max 2 sentences
    2. ** Engage, Don't Sell** - Ask questions, invite discussion
    3. ** Match the Tone ** - Align with the post's vibe
    4. ** Natural Flow ** - Should feel like a conversation closer
    
    CTA TYPES TO VARY:
    - Question: "Setuju? Atau ada perspektif lain?"
        - Invitation: "Share pengalaman kalian di comments 👇"
            - Reflection: "Bagaimana menurut kalian?"
                - Community: "Tag someone yang perlu baca ini!"

    LANGUAGE:
    - Use Bahasa Indonesia conversationally
        - Keep emoji usage light(1-2 max per CTA)
            - Authentic and warm tone
    
    OUTPUT FORMAT:
    - STRICT JSON ARRAY ONLY.
    - DO NOT include "Here are...", "Below are...", or any intro text.
    - Start immediately with [.
    - End immediately with ].

    Example: ["CTA 1", "CTA 2", "CTA 3", "CTA 4"]
    `;

        try {
            // Try Eigen AI with Grant first if grant provided
            if (grant) {
                const response = await callEigenGrantAPI(
                    [{ role: 'user', content: prompt }],
                    resolveModelId(model),
                    grant
                );
                const content = response.choices[0]?.message?.content || '[]';
                const result = cleanAndParseJSON(content);
                const signature = response.signature;
                return { result, signature };
            }

            const completion = await openai.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: resolveModelId(model),
                temperature: 0.75,
                max_tokens: 1500,
            });

            const content = completion.choices[0]?.message?.content || '[]';
            const result = cleanAndParseJSON(content);
            const signature = (completion as any).signature;

            return { result, signature };
        } catch (e: any) {
            console.error("AI Error (CTA):", e?.message || e);

            // If Eigen Grant fails, fallback to Groq
            if (grant && !isUsingGroq) {
                switchToGroq();
                return generateCTA(body, intent, model);
            }

            // If authentication error and not using Groq yet, switch and retry
            if (!isUsingGroq && e?.status === 401) {
                switchToGroq();
                return generateCTA(body, intent, model);
            }

            return { result: ["Bagaimana menurut kalian?", "Setuju? 👇", "Share pengalaman kalian!", "Thoughts?"] };
        }
    }

    // 5. Polish (Final) - ROBUST VERSION
    export async function polishContent(content: string, tone: number, emojiDensity: number): Promise<AIResponse<string>> {
        const emojiInstruction = getEmojiInstruction(emojiDensity);
        const toneInstruction = getToneInstruction(tone);

        const prompt = `Polish this LinkedIn post following this EXACT structure for consistency:

Original post:
    "${content}"

${toneInstruction}
${emojiInstruction}

FORMATTING RULES(CRITICAL):
    1. **Line Breaks**: Add proper spacing between paragraphs(double newline).
2. **Visual Hierarchy**: Use CAPS for 1-2 key phrases.
3. **Readability**: Keep sentences short and punchy.
4. **Hashtags**: Add max 5 hashtags at the end.

Return ONLY the polished post text, nothing else.`;

        try {
            const completion = await openai.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: resolveModelId(),
                temperature: 0.3,
            });
            const result = completion.choices[0]?.message?.content || content;
            const signature = (completion as any).signature;
            return { result, signature };
        } catch (e: any) {
            console.error("AI Error (Polish):", e?.message || e);

            // If authentication error and not using Groq yet, switch and retry
            if (!isUsingGroq && e?.status === 401) {
                switchToGroq();
                return polishContent(content, tone, emojiDensity);
            }

            return { result: content };
        }
    }

    // 6. Tiered Generation Orchestrator
    export async function generateTieredContent(tier: number, contentId: string): Promise<any> {
        console.log(`[AI] Generating content for Tier ${tier}(ID: ${contentId})`);

        // Default context
        const input = "AI in Marketing";
        const intent = "educational";

        try {
            if (tier === 1) {
                const topicsRes = await generateTopics(input);
                const selectedTopic = topicsRes.result[0];
                const hooksRes = await generateHooks(selectedTopic, intent);
                const bodiesRes = await generateBody(hooksRes.result[0], selectedTopic, intent, "short");

                return {
                    tier: 1,
                    topic: selectedTopic,
                    hook: hooksRes.result[0],
                    body: bodiesRes.result[0],
                    status: "completed"
                };
            }
            else if (tier === 2) {
                const topicsRes = await generateTopics(input);
                const selectedTopic = topicsRes.result[0];
                const hooksRes = await generateHooks(selectedTopic, intent);
                const bodiesRes = await generateBody(hooksRes.result[0], selectedTopic, intent, "medium");

                return {
                    tier: 2,
                    topic: selectedTopic,
                    hooks: hooksRes.result,
                    bodyOptions: bodiesRes.result,
                    status: "completed"
                };
            }
            else if (tier === 3) {
                const topicsRes = await generateTopics(input);
                const selectedTopic = topicsRes.result[0];
                const hooksRes = await generateHooks(selectedTopic, intent);
                const bodiesRes = await generateBody(hooksRes.result[0], selectedTopic, intent, "long");
                const ctasRes = await generateCTA(bodiesRes.result[0], intent);
                const polishedRes = await polishContent(bodiesRes.result[0], 8, 5);

                return {
                    tier: 3,
                    topic: selectedTopic,
                    hooks: hooksRes.result,
                    bodies: bodiesRes.result,
                    ctas: ctasRes.result,
                    finalPolished: polishedRes.result,
                    status: "completed"
                };
            }
        } catch (error) {
            console.error("AI Generation Failed:", error);
            throw new Error("AI generation failed");
        }
    }

