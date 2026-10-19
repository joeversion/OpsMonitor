import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { writeFrontendLog } from '../utils/log-storage';

const router = Router();
const batchSchema = z.object({
  entries: z.array(z.object({
    level: z.enum(['warn', 'error']),
    message: z.string().min(1).max(4096)
  }).strict()).min(1).max(20)
}).strict();

router.post('/frontend', authenticate, rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: req => String(req.user!.userId),
  standardHeaders: 'draft-8',
  legacyHeaders: false
}), (req, res) => {
  const batch = batchSchema.safeParse(req.body);
  if (!batch.success) {
    return res.status(400).json({ error: 'Invalid frontend log batch' });
  }
  for (const entry of batch.data.entries) {
    writeFrontendLog(entry.level, entry.message, req.user!.userId);
  }
  res.status(204).end();
});

export default router;