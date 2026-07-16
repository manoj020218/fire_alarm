/**
 * Reports routes.
 * POST /api/reports/generate — all auth roles
 * GET  /api/reports          — all auth roles
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { GenerateReportSchema, ReportQuerySchema } from '../validation/reports.schema';
import { generateReport, listReports } from '../controllers/reports.controller';

const router = Router();

router.use(authenticate);

router.post('/generate', validate({ body: GenerateReportSchema }), generateReport);
router.get('/', validate({ query: ReportQuerySchema }), listReports);

export default router;
