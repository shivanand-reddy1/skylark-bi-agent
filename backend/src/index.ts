import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { chatRouter } from './routes/chat';
import { healthRouter } from './routes/health';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    const allowed = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'https://skylark-bi-agent-teal.vercel.app',
    ].filter(Boolean);
    if (allowed.some(o => origin.startsWith(o))) {
      callback(null, true);
    } else {
      // Allow all vercel.app domains for preview deployments
      if (origin.endsWith('.vercel.app')) {
        callback(null, true);
      } else {
        callback(null, true); // permissive for now
      }
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Rate limiting — protect against abuse
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'Too many requests. Please slow down.' },
});
app.use('/api', limiter);

// Routes
app.use('/api/chat', chatRouter);
app.use('/api/health', healthRouter);

// Global error handler — never expose stack traces
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'An internal error occurred. Please try again.' });
});

app.listen(PORT, () => {
  console.log(`Skylark BI Backend running on http://localhost:${PORT}`);
});

export default app;
