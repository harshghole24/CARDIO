# CardIO - Run Your Cards Smarter

Welcome to the CardIO full-stack application workspace. This project has been scaffolded to meet your B.Tech mini-project requirements.

## Architecture Overview
- **Frontend (`/client`)**: React.js with Vite, Tailwind CSS, TypeScript, and Framer Motion for beautiful animated cards.
- **Backend (`/server`)**: Node.js and Express.js REST APIs for handling complex logic (like rule-based card recommendations).
- **Analytics (`/analytics`)**: Python module for data processing and reports.
- **Database (`/database`)**: Supabase (PostgreSQL) schema file ready to be applied.

## Setup Instructions

### 1. Database (Supabase) Setup
1. Go to [Supabase](https://supabase.com) and create a new project.
2. In the SQL Editor, copy and paste the contents of `database/schema.sql` and run it to create your normalized tables and Row Level Security (RLS) policies.
3. Get your **Project URL** and **anon key** from the API settings.

### 2. Backend Server Setup
1. Open a terminal and navigate to the `server` directory: `cd server`
2. Create a `.env` file and add your Supabase credentials:
   ```env
   PORT=5000
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
3. Update `package.json` scripts to include: `"dev": "nodemon index.ts"`
4. Run the server: `npm run dev`

### 3. Frontend Client Setup
1. Open a terminal and navigate to the `client` directory: `cd client`
2. Create a `.env` file and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
3. Ensure Tailwind is configured. You may need to run `npx tailwindcss init -p` and set up `tailwind.config.js`.
4. Run the frontend: `npm run dev`

### 4. Python Analytics Setup
1. Open a terminal and navigate to the `analytics` directory.
2. Set up a virtual environment: `python -m venv venv`
3. Activate it and install dependencies: `pip install fastapi uvicorn pandas supabase`

## Implemented Core Features
I have scaffolded the core components that demonstrate the "premium fintech" feel:
- `client/src/components/AnimatedCard.tsx`: A beautiful, 3D animated credit card component using Framer Motion (hover, tilt, shine effects).
- `client/src/components/TravelExecutionPlan.tsx`: The "Killer Feature" UI that shows the step-by-step progress of a travel goal with animated timelines.
- `server/index.ts`: The Express server scaffolding with a mock endpoint for the **Card Recommendation Engine**.
- `database/schema.sql`: The complete, normalized PostgreSQL schema including profiles, cards, categories, loyalty programs, goals, and RLS policies.

## Next Steps for the User
1. **Authentication**: Implement Supabase Auth (Login/Register) in the frontend using `@supabase/supabase-js`.
2. **Dashboard Assembly**: Use the provided `AnimatedCard` and `TravelExecutionPlan` components to build the main dashboard view in `App.tsx`.
3. **API Integration**: Connect the frontend to the Express backend and Supabase directly for CRUD operations (transactions, adding cards).
