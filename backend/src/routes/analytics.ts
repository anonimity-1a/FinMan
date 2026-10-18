import { Router } from 'express';
import { categories, daily, parser, summary } from '../controllers/analyticsController.js';

const r = Router();
r.get('/daily', daily);
r.get('/categories', categories);
r.get('/summary', summary);
r.get('/parser', parser);
export default r;
