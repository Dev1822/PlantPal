// server.js - PlantPal Express Backend
// Run: node server.js
// Dev: nodemon server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./database/db');
const { analyzeConditions, calculateHealthScore } = require('./engine/recommendationEngine');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// Request logger in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── GET /plants ──────────────────────────────────────────────────────────────
// Returns the full list of plants (id, name, common_name, category, care_difficulty)
app.get('/plants', async (_req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, name, common_name, category, care_difficulty,
              ideal_light, ideal_water_frequency,
              ideal_temperature_min, ideal_temperature_max,
              ideal_humidity, fertilizer_schedule, description
       FROM plants
       ORDER BY name ASC`
    );
    res.json({ success: true, count: rows.length, plants: rows });
  } catch (err) {
    console.error('GET /plants error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch plants' });
  }
});

// ─── GET /plants/:id ──────────────────────────────────────────────────────────
// Returns a single plant by ID
app.get('/plants/:id', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM plants WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Plant not found' });
    res.json({ success: true, plant: rows[0] });
  } catch (err) {
    console.error('GET /plants/:id error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch plant' });
  }
});

// ─── POST /analyze ────────────────────────────────────────────────────────────
// Accepts plant + environment data and returns personalized care recommendations
app.post('/analyze', async (req, res) => {
  const { plant_id, light, temperature, humidity, watering_habit } = req.body;

  // Validation
  if (!plant_id || !light || temperature === undefined || humidity === undefined || !watering_habit) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: plant_id, light, temperature, humidity, watering_habit'
    });
  }

  const validLights = ['Low', 'Medium', 'High'];
  if (!validLights.includes(light)) {
    return res.status(400).json({ success: false, error: 'light must be Low, Medium, or High' });
  }

  try {
    const [rows] = await db.execute('SELECT * FROM plants WHERE id = ?', [plant_id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Plant not found' });

    const plant = rows[0];
    const userConditions = {
      light,
      temperature: parseFloat(temperature),
      humidity: parseInt(humidity),
      watering_habit: parseInt(watering_habit)
    };

    const analysis = analyzeConditions(plant, userConditions);
    res.json({ success: true, analysis });
  } catch (err) {
    console.error('POST /analyze error:', err);
    res.status(500).json({ success: false, error: 'Analysis failed' });
  }
});

// ─── POST /user-plant ─────────────────────────────────────────────────────────
// Stores a user's plant and environment data
app.post('/user-plant', async (req, res) => {
  const { user_id, plant_id, light, temperature, humidity, watering_habit, notes } = req.body;

  if (!plant_id || !light || temperature === undefined || humidity === undefined || !watering_habit) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  try {
    // Verify plant exists
    const [plantRows] = await db.execute('SELECT * FROM plants WHERE id = ?', [plant_id]);
    if (!plantRows.length) return res.status(404).json({ success: false, error: 'Plant not found' });

    const plant = plantRows[0];
    const health_score = calculateHealthScore(plant, {
      light,
      temperature: parseFloat(temperature),
      humidity: parseInt(humidity),
      watering_habit: parseInt(watering_habit)
    });

    const [result] = await db.execute(
      `INSERT INTO user_plants (user_id, plant_id, light, temperature, humidity, watering_habit, health_score, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id || null, plant_id, light, parseFloat(temperature), parseInt(humidity),
       parseInt(watering_habit), health_score, notes || null]
    );

    res.status(201).json({
      success: true,
      message: 'Plant saved successfully',
      id: result.insertId,
      health_score
    });
  } catch (err) {
    console.error('POST /user-plant error:', err);
    res.status(500).json({ success: false, error: 'Failed to save plant' });
  }
});

// ─── GET /user-plants ─────────────────────────────────────────────────────────
// Returns recent saved user plants (with plant info joined)
app.get('/user-plants', async (_req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT up.*, p.name, p.common_name, p.category, p.care_difficulty
       FROM user_plants up
       JOIN plants p ON up.plant_id = p.id
       ORDER BY up.created_at DESC
       LIMIT 50`
    );
    res.json({ success: true, user_plants: rows });
  } catch (err) {
    console.error('GET /user-plants error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch user plants' });
  }
});

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌿 PlantPal API running on http://localhost:${PORT}`);
  console.log(`📋 Endpoints:`);
  console.log(`   GET  /plants`);
  console.log(`   GET  /plants/:id`);
  console.log(`   POST /analyze`);
  console.log(`   POST /user-plant`);
  console.log(`   GET  /user-plants\n`);
});
