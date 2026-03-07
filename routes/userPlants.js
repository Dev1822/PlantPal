import express from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../server.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'plantcare_secret';

// ────────────────────────────────────────────────
// JWT Auth Middleware
// ────────────────────────────────────────────────
const auth = (req, res, next) => {
    const authHeader = req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ message: 'Token is invalid or expired' });
    }
};

// ────────────────────────────────────────────────
// 🌿 RECOMMENDATION ENGINE
// Personalizes care schedules based on the user's
// specific environment: light, humidity, temperature
// ────────────────────────────────────────────────
function calculateRecommendations(plant, environment, lastWatered, lastFertilized) {
    let waterDays = plant.water_frequency_days;
    let fertilizeDays = plant.fertilize_frequency_days;

    // Temperature adjustments
    if (environment.temp > plant.max_temp) {
        // High heat: water more frequently
        waterDays = Math.max(2, waterDays - 3);
    } else if (environment.temp < plant.min_temp) {
        // Cold: slow metabolism, water less
        waterDays += 3;
    }

    // Humidity adjustments
    const optimalHumidity = (() => {
        try { return JSON.parse(plant.optimal_humidity); } catch { return plant.optimal_humidity; }
    })();

    if (environment.humidity === 'Low' && optimalHumidity !== 'Low') {
        waterDays = Math.max(2, waterDays - 2);
    } else if (environment.humidity === 'High' && optimalHumidity !== 'High') {
        waterDays += 2;
    }

    // Light adjustments
    if (environment.light === 'Direct Sun') {
        waterDays = Math.max(2, waterDays - 2);
    } else if (environment.light === 'Low Light') {
        waterDays += 1;
        fertilizeDays += 7; // Less growth in low light, fertilize less often
    }

    // Calculate next dates
    const nextWater = new Date(lastWatered || new Date());
    nextWater.setDate(nextWater.getDate() + waterDays);

    const nextFertilize = new Date(lastFertilized || new Date());
    nextFertilize.setDate(nextFertilize.getDate() + fertilizeDays);

    // ─── Predictive Health Alerts (ML-style rule engine) ───
    let predictedHealthAlert = null;
    let healthScore = 100;

    if (environment.temp > plant.max_temp + 5) {
        predictedHealthAlert = '🔴 Critical Heat Stress: Plant is at high risk of wilting. Move to a cooler location immediately!';
        healthScore -= 40;
    } else if (environment.temp > plant.max_temp) {
        predictedHealthAlert = '🟡 Heat Warning: Temperature is above optimal range. Monitor closely and ensure adequate water.';
        healthScore -= 20;
    } else if (environment.temp < plant.min_temp) {
        predictedHealthAlert = '🟡 Cold Warning: Temperature is below optimal. Risk of root damage. Move to a warmer spot.';
        healthScore -= 20;
    }

    if (!predictedHealthAlert && environment.humidity === 'Low' && optimalHumidity === 'High') {
        predictedHealthAlert = '🟠 Crispy Leaves Risk: Humidity is too low for this species. Mist leaves daily or use a humidifier.';
        healthScore -= 25;
    }

    if (!predictedHealthAlert && environment.light === 'Low Light' && optimalHumidity !== 'Low') {
        const optLight = (() => {
            try { return JSON.parse(plant.optimal_light); } catch { return plant.optimal_light; }
        })();
        if (optLight === 'Bright Indirect' || optLight === 'Direct Sun') {
            predictedHealthAlert = '🟡 Light Deficiency: This plant needs more light. Consider moving closer to a window or using a grow light.';
            healthScore -= 15;
        }
    }

    return {
        nextWater: nextWater.toISOString(),
        nextFertilize: nextFertilize.toISOString(),
        adjustedWaterDays: waterDays,
        adjustedFertilizeDays: fertilizeDays,
        predictedHealthAlert,
        healthScore: Math.max(0, healthScore)
    };
}

// ────────────────────────────────────────────────
// GET /api/user-plants — user's garden with recs
// ────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
    try {
        const [userPlants] = await pool.query(`
            SELECT 
                up.*,
                p.name        AS species_name,
                p.family,
                p.description AS species_description,
                p.optimal_light,
                p.optimal_humidity,
                p.max_temp,
                p.min_temp,
                p.water_frequency_days,
                p.fertilize_frequency_days,
                p.difficulty,
                p.toxic_to_pets
            FROM User_Plants up
            JOIN Plants p ON up.plant_id = p.id
            WHERE up.user_id = ?
            ORDER BY up.added_at DESC
        `, [req.user.id]);

        const enhanced = userPlants.map(plant => {
            const env = {
                light: plant.environment_light,
                humidity: plant.environment_humidity,
                temp: plant.environment_temp
            };
            const rec = calculateRecommendations(
                plant, env,
                plant.last_watered,
                plant.last_fertilized
            );
            return { ...plant, recommendations: rec };
        });

        res.json(enhanced);
    } catch (error) {
        console.error('Get user plants error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ────────────────────────────────────────────────
// POST /api/user-plants — add plant to garden
// ────────────────────────────────────────────────
router.post('/', auth, async (req, res) => {
    try {
        const {
            plant_id,
            custom_name,
            environment_light = 'Bright Indirect',
            environment_humidity = 'Medium',
            environment_temp = 22
        } = req.body;

        if (!plant_id) {
            return res.status(400).json({ message: 'plant_id is required' });
        }

        // Check plant exists
        const [plants] = await pool.query('SELECT id FROM Plants WHERE id = ?', [plant_id]);
        if (plants.length === 0) {
            return res.status(404).json({ message: 'Plant species not found' });
        }

        // Check not already added
        const [existing] = await pool.query(
            'SELECT id FROM User_Plants WHERE user_id = ? AND plant_id = ?',
            [req.user.id, plant_id]
        );
        if (existing.length > 0) {
            return res.status(400).json({ message: 'You already have this plant in your garden' });
        }

        const [result] = await pool.query(`
            INSERT INTO User_Plants (user_id, plant_id, custom_name, environment_light, environment_humidity, environment_temp, last_watered, last_fertilized)
            VALUES (?, ?, ?, ?, ?, ?, date('now'), date('now', '-7 days'))
        `, [req.user.id, plant_id, custom_name || null, environment_light, environment_humidity, environment_temp]);

        res.status(201).json({ id: result.insertId, message: 'Plant added to your garden!' });
    } catch (error) {
        console.error('Add plant error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ────────────────────────────────────────────────
// POST /api/user-plants/:id/log — log care action
// ────────────────────────────────────────────────
router.post('/:id/log', auth, async (req, res) => {
    try {
        const { action_type, notes } = req.body;
        const userPlantId = req.params.id;

        if (!['Watered', 'Fertilized'].includes(action_type)) {
            return res.status(400).json({ message: 'action_type must be Watered or Fertilized' });
        }

        // Verify ownership
        const [rows] = await pool.query(
            'SELECT id FROM User_Plants WHERE id = ? AND user_id = ?',
            [userPlantId, req.user.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Plant not found in your garden' });
        }

        // Log the action
        await pool.query(`
            INSERT INTO Care_Logs (user_plant_id, action_type, notes, action_date)
            VALUES (?, ?, ?, date('now'))
        `, [userPlantId, action_type, notes || null]);

        // Update last care date
        if (action_type === 'Watered') {
            await pool.query(
                "UPDATE User_Plants SET last_watered = date('now') WHERE id = ?",
                [userPlantId]
            );
        } else {
            await pool.query(
                "UPDATE User_Plants SET last_fertilized = date('now') WHERE id = ?",
                [userPlantId]
            );
        }

        res.json({ message: `${action_type} logged successfully!` });
    } catch (error) {
        console.error('Log care error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ────────────────────────────────────────────────
// DELETE /api/user-plants/:id — remove from garden
// ────────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
    try {
        const [result] = await pool.query(
            'DELETE FROM User_Plants WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Plant not found in your garden' });
        }
        res.json({ message: 'Plant removed from garden' });
    } catch (error) {
        console.error('Delete plant error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
