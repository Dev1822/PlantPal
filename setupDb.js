import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

// ────────────────────────────────────────────────
// Plant data generation — 225 species
// ────────────────────────────────────────────────
const prefixes = [
    'Mini', 'Giant', 'Tropical', 'Desert', 'Alpine', 'Golden', 'Silver', 'Royal',
    'Dwarf', 'Variegated', 'Trailing', 'Climbing', 'Bushy', 'Spotted', 'Striped'
];
const rootNames = [
    'Fern', 'Palm', 'Ivy', 'Cactus', 'Succulent', 'Orchid', 'Lily', 'Ficus',
    'Pothos', 'Monstera', 'Philodendron', 'Bonsai', 'Bamboo', 'Aloe', 'Begonia'
];
const families = [
    'Polypodiaceae', 'Arecaceae', 'Araliaceae', 'Cactaceae', 'Crassulaceae',
    'Orchidaceae', 'Liliaceae', 'Moraceae', 'Araceae', 'Araceae',
    'Araceae', 'Rosaceae', 'Poaceae', 'Asphodelaceae', 'Begoniaceae'
];
const lightOptions = ['Bright Indirect', 'Low Light', 'Direct Sun'];
const humidityOptions = ['High', 'Medium', 'Low'];

function generatePlants() {
    const plants = [];
    let count = 0;
    for (let i = 0; i < prefixes.length; i++) {
        for (let j = 0; j < rootNames.length; j++) {
            count++;
            const lightIdx = count % 3;
            const humidIdx = count % 3;
            const tempVars = [{ min: 10, max: 18 }, { min: 15, max: 22 }, { min: 18, max: 28 }, { min: 12, max: 24 }];
            const tv = tempVars[count % 4];
            const waterDays = (count % 12) + 3;        // 3–14 days
            const fertDays = (count % 50) + 14;        // 14–63 days
            plants.push({
                name: `${prefixes[i]} ${rootNames[j]}`,
                family: families[j],
                description: `A beautiful ${lightOptions[lightIdx].toLowerCase()}-loving plant that thrives in ${humidityOptions[humidIdx].toLowerCase()} humidity environments.`,
                optimal_light: JSON.stringify(lightOptions[lightIdx]),
                optimal_humidity: JSON.stringify(humidityOptions[humidIdx]),
                max_temp: tv.max,
                min_temp: tv.min,
                water_frequency_days: waterDays,
                fertilize_frequency_days: fertDays,
                difficulty: ['Beginner', 'Intermediate', 'Expert'][count % 3],
                toxic_to_pets: count % 4 === 0 ? 1 : 0
            });
            if (count >= 225) break;
        }
        if (count >= 225) break;
    }
    return plants;
}

async function setup() {
    console.log('🌱 Setting up PlantCare database...\n');

    const db = await open({
        filename: './plantcare_db.sqlite',
        driver: sqlite3.Database
    });

    await db.exec('PRAGMA foreign_keys = ON;');

    // ─── Tables ───
    console.log('📋 Creating tables...');

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Users (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            username        TEXT    UNIQUE NOT NULL,
            email           TEXT    UNIQUE NOT NULL,
            password_hash   TEXT    NOT NULL,
            created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Plants (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            name                    TEXT    NOT NULL,
            family                  TEXT,
            description             TEXT,
            optimal_light           TEXT    NOT NULL,
            optimal_humidity        TEXT    NOT NULL,
            max_temp                INTEGER NOT NULL,
            min_temp                INTEGER NOT NULL,
            water_frequency_days    INTEGER NOT NULL,
            fertilize_frequency_days INTEGER NOT NULL,
            difficulty              TEXT    DEFAULT 'Beginner',
            toxic_to_pets           INTEGER DEFAULT 0
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS User_Plants (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id             INTEGER NOT NULL,
            plant_id            INTEGER NOT NULL,
            custom_name         TEXT,
            environment_light   TEXT,
            environment_humidity TEXT,
            environment_temp    INTEGER,
            last_watered        DATE,
            last_fertilized     DATE,
            health_status       TEXT DEFAULT 'Good',
            added_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id)  REFERENCES Users(id) ON DELETE CASCADE,
            FOREIGN KEY (plant_id) REFERENCES Plants(id) ON DELETE CASCADE
        );
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS Care_Logs (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_plant_id   INTEGER NOT NULL,
            action_type     TEXT    NOT NULL,
            notes           TEXT,
            action_date     DATE    NOT NULL,
            created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_plant_id) REFERENCES User_Plants(id) ON DELETE CASCADE
        );
    `);

    console.log('✅ Tables created.\n');

    // ─── Seed Plants ───
    const { count: plantCount } = await db.get('SELECT COUNT(*) as count FROM Plants');
    if (plantCount < 200) {
        console.log('🌿 Seeding 225 plant species...');
        const plants = generatePlants();
        const stmt = await db.prepare(`
            INSERT INTO Plants (name, family, description, optimal_light, optimal_humidity, max_temp, min_temp, water_frequency_days, fertilize_frequency_days, difficulty, toxic_to_pets)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const p of plants) {
            await stmt.run(
                p.name, p.family, p.description, p.optimal_light, p.optimal_humidity,
                p.max_temp, p.min_temp, p.water_frequency_days, p.fertilize_frequency_days,
                p.difficulty, p.toxic_to_pets
            );
        }
        await stmt.finalize();
        console.log(`✅ Inserted ${plants.length} plant species.\n`);
    } else {
        console.log(`ℹ️  Plants already seeded (${plantCount} records). Skipping.\n`);
    }

    // ─── Demo User ───
    const demoUser = await db.get("SELECT id FROM Users WHERE email = 'demo@demo.com'");
    if (!demoUser) {
        console.log('👤 Creating demo user (demo@demo.com / password)...');
        const hash = await bcrypt.hash('password', 10);
        const result = await db.run(
            "INSERT INTO Users (username, email, password_hash) VALUES (?, ?, ?)",
            ['demo', 'demo@demo.com', hash]
        );

        // Add 3 sample plants for demo user
        const samplePlants = await db.all('SELECT id FROM Plants LIMIT 3');
        const lights = ['Bright Indirect', 'Low Light', 'Direct Sun'];
        const humids = ['Medium', 'Low', 'High'];
        const temps = [22, 18, 26];

        for (let k = 0; k < samplePlants.length; k++) {
            await db.run(`
                INSERT INTO User_Plants (user_id, plant_id, custom_name, environment_light, environment_humidity, environment_temp, last_watered, last_fertilized)
                VALUES (?, ?, ?, ?, ?, ?, date('now', '-3 days'), date('now', '-10 days'))
            `, [result.lastID, samplePlants[k].id, null, lights[k], humids[k], temps[k]]);
        }

        console.log('✅ Demo user created with 3 sample plants.\n');
    } else {
        console.log('ℹ️  Demo user already exists. Skipping.\n');
    }

    console.log('🎉 Database setup complete! Run: node server.js');
    await db.close();
    process.exit(0);
}

setup().catch(err => {
    console.error('❌ Setup failed:', err);
    process.exit(1);
});
