# 🌿 PlantPal – Personalized Plant Care Recommendation Platform

A full-stack web application that analyzes your plant's environment and generates personalized care recommendations with a visual health score.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TailwindCSS |
| Backend | Node.js + Express |
| Database | MySQL |
| Charts | Recharts |
| Communication | REST APIs |

---

## Project Structure

```
plantpal/
├── frontend/           # React + Vite app
│   ├── src/
│   │   ├── components/
│   │   │   ├── PlantForm.jsx          # Input form with plant selector
│   │   │   ├── RecommendationCard.jsx # Results + health score
│   │   │   ├── ConditionCharts.jsx    # Recharts visualizations
│   │   │   ├── HealthScoreRing.jsx    # Animated SVG score ring
│   │   │   └── MyPlants.jsx           # Saved plants gallery
│   │   ├── utils/
│   │   │   └── api.js                 # API client
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── backend/            # Node.js + Express API
│   ├── server.js               # Main server file
│   ├── database/
│   │   ├── db.js               # MySQL connection pool
│   │   └── seed.js             # Database seeder (200+ plants)
│   ├── engine/
│   │   └── recommendationEngine.js  # Core analysis logic
│   └── .env.example
│
└── database/
    └── schema.sql      # SQL schema for manual setup
```

---

## Setup

### Prerequisites
- Node.js 18+
- MySQL 8.0+

### 1. Database Setup

```bash
# Start MySQL and create the database + tables + seed data
cd backend
cp .env.example .env
# Edit .env with your MySQL credentials

npm install
npm run seed   # Creates DB, tables, and seeds 200+ plants
```

### 2. Backend

```bash
cd backend
node server.js
# Server starts on http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Opens http://localhost:5173
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/plants` | List all plants |
| GET | `/plants/:id` | Get a single plant |
| POST | `/analyze` | Generate care recommendations |
| POST | `/user-plant` | Save a user's plant + conditions |
| GET | `/user-plants` | Retrieve saved plants |
| GET | `/health` | Health check |

### POST /analyze — Example Request
```json
{
  "plant_id": 11,
  "light": "Low",
  "temperature": 20,
  "humidity": 45,
  "watering_habit": 5
}
```

### POST /analyze — Example Response
```json
{
  "success": true,
  "analysis": {
    "plant": { "name": "Monstera deliciosa", "category": "Tropical", ... },
    "healthScore": 78,
    "healthLabel": "Healthy 🌱",
    "recommendations": [
      {
        "category": "Watering",
        "status": "warning",
        "icon": "💧",
        "message": "Increase watering to every 7 days.",
        "detail": "Current: every 5 days | Ideal: every 7 days..."
      },
      ...
    ]
  }
}
```

---

## Health Score System

The Plant Health Score (0–100) is calculated from four weighted factors:

| Factor | Weight | Logic |
|--------|--------|-------|
| Temperature | 30 pts | -2pts per °C outside ideal range |
| Watering | 25 pts | Proportional to deviation from ideal frequency |
| Humidity | 25 pts | Proportional to deviation from ideal |
| Light | 20 pts | 20 = perfect, 10 = one level off, 0 = two levels off |

**Score Labels:**
- 85–100: Thriving 🌟
- 70–84: Healthy 🌱
- 50–69: Needs Attention ⚠️
- 0–49: Struggling 🆘

---

## Features

- **200+ plant species** with ideal care conditions
- **Smart recommendations** for watering, temperature, humidity, light, and fertilizer
- **Animated health score ring** with smooth CSS transition
- **Interactive charts**: Radar overview + individual bar charts
- **Plant search + category filter** with live results
- **Save & track** plants across sessions
- **Backend connection status** indicator
- **Responsive design** for mobile and desktop

---
