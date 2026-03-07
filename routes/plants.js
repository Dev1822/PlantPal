import express from 'express';
import { pool } from '../server.js';

const router = express.Router();

// GET /api/plants — all species for catalog
router.get('/', async (_req, res) => {
    try {
        const [plants] = await pool.query(
            'SELECT * FROM Plants ORDER BY name ASC'
        );
        res.json(plants);
    } catch (error) {
        console.error('Plants error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/plants/search?q=fern
router.get('/search', async (req, res) => {
    try {
        const { q = '' } = req.query;
        const [plants] = await pool.query(
            'SELECT * FROM Plants WHERE name LIKE ? OR family LIKE ? ORDER BY name ASC',
            [`%${q}%`, `%${q}%`]
        );
        res.json(plants);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/plants/:id — single plant detail
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM Plants WHERE id = ?',
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Plant not found' });
        res.json(rows[0]);
    } catch (error) {
        console.error('Plant detail error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
