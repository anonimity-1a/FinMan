import { Router } from 'express';
import * as c from '../controllers/entryController.js';

const r = Router();
r.post('/', c.createEntry);
r.get('/', c.listEntries);
r.get('/:id', c.getEntry);
r.put('/:id', c.updateEntry);
r.delete('/:id', c.deleteEntry);
export default r;
