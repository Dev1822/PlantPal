import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../server.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'plantcare_secret';

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        const [existing] = await pool.query(
            'SELECT id FROM Users WHERE email = ? OR username = ?',
            [email, username]
        );
        if (existing.length > 0) {
            return res.status(400).json({ message: 'Email or username already in use' });
        }

        const hash = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            'INSERT INTO Users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, hash]
        );

        const token = jwt.sign({ id: result.insertId }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({
            token,
            user: { id: result.insertId, username, email }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const [users] = await pool.query(
            'SELECT * FROM Users WHERE email = ?',
            [email]
        );
        if (users.length === 0) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            token,
            user: { id: user.id, username: user.username, email: user.email }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

export default router;
