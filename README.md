# AI-Backend

AI-powered backend API for LinkedIn Post Generator using Groq and Tavily.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```env
PORT=4000
CORS_ORIGIN=http://localhost:3000
GROQ_API_KEY=your_key_here
TAVILY_API_KEY=your_key_here
```

3. Run development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
npm start
```

## API Endpoints

### POST /api/generate
Generate content based on step.

**Request:**
```json
{
  "step": "topics|hooks|body|cta",
  "input": "string",
  "context": "string",
  "intent": "viral|storytelling|educational",
  "length": "short|medium|long"
}
```

**Response:**
```json
{
  "result": ["option1", "option2", ...]
}
```

### POST /api/polish
Polish final content.

**Request:**
```json
{
  "content": "string",
  "tone": 1-10,
  "emojiDensity": 1-10
}
```

**Response:**
```json
{
  "result": "polished content"
}
```

### GET /health
Health check endpoint.

## Tech Stack
- Express.js
- TypeScript
- Groq SDK (LLM)
- Tavily (Research)
