import { Router } from 'express';
import multer from 'multer';
import { parseFile, parseText } from '../controllers/parserController.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const r = Router();
r.post('/', parseText);
r.post('/file', upload.single('file'), parseFile);
export default r;
