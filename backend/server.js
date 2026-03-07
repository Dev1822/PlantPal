import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ────────────────────────────────────────────────
// SQLite Pool wrapper (mimics mysql2 .query() API)
// ────────────────────────────────────────────────
let dbInstance;

export const pool = {
    query: async (sql, params = []) => {
        try {
            if (!dbInstance) {
                dbInstance = await open({
                    filename: './plantcare_db.sqlite',
                    driver: sqlite3.Database
                });
                // Enable WAL mode for better concurrency
                await dbInstance.exec('PRAGMA journal_mode = WAL;');
                await dbInstance.exec('PRAGMA foreign_keys = ON;');
            }

            const textSql = sql.trim().toUpperCase();

            if (textSql.startsWith('SELECT')) {
                const rows = await dbInstance.all(sql, params);
                return [rows];
            } else if (
                textSql.startsWith('START TRANSACTION') ||
                textSql.startsWith('BEGIN') ||
                textSql.startsWith('COMMIT') ||
                textSql.startsWith('ROLLBACK')
            ) {
                await dbInstance.exec(sql.trim());
                return [];
            } else {
                const result = await dbInstance.run(sql, params);
                return [{ insertId: result.lastID, affectedRows: result.changes }];
            }
        } catch (err) {
            console.error('SQL Error:', err.message, '\nSQL:', sql);
            throw err;
        }
    }
};

// ────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────
import authRoutes from './routes/auth.js';
import plantsRoutes from './routes/plants.js';
import userPlantsRoutes from './routes/userPlants.js';

app.use('/api/auth', authRoutes);
app.use('/api/plants', plantsRoutes);
app.use('/api/user-plants', userPlantsRoutes);

app.get('/', (_req, res) => {
    res.json({ message: 'PlantCare API running ✅', version: '1.0.0' });
});

app.listen(port, () => {
    console.log(`\n🌿 PlantCare Backend running on http://localhost:${port}`);
});
