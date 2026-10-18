import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { app } from './app.js';

await connectDb();
app.listen(env.PORT, () => console.log(`API on http://localhost:${env.PORT}`));
