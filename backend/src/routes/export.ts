import { Router } from 'express';
import { exportCsv, exportJson } from '../controllers/exportController.js';

const r = Router();
r.get('/json', exportJson);
r.get('/csv', exportCsv);
export default r;
