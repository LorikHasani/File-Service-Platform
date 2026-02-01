# ECU Tuning Platform

A professional ECU tuning file service platform built with React, TypeScript, and Supabase.

## Features

- 🔐 User authentication (clients & admins)
- 📁 File upload/download for ECU files
- 💬 Real-time messaging between clients and admins
- 💰 Credit-based payment system
- 📊 Admin dashboard with statistics
- 🎨 Modern dark/light mode UI

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **State**: Zustand
- **Routing**: React Router v6

## Deployment to Vercel

### Step 1: Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the SQL schema (see `SETUP.md` or use the provided SQL files)
3. Create a storage bucket named `ecu-files` (private)
4. Enable Realtime for tables: `job_messages`, `jobs`, `files`

### Step 2: Deploy to Vercel

1. Push this code to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and import the repository
3. Add Environment Variables in Vercel:
   - `VITE_SUPABASE_URL` = Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase anon/public key

4. Deploy!

### Step 3: Post-Deployment

1. Update Supabase Auth settings:
   - Go to Authentication → URL Configuration
   - Add your Vercel URL to "Site URL"
   - Add your Vercel URL to "Redirect URLs"

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

## Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your Supabase credentials

# Start development server
npm run dev
```

## Build

```bash
npm run build
```

## Project Structure

```
src/
├── components/     # Reusable UI components
├── hooks/          # Custom React hooks (Supabase queries)
├── lib/            # Supabase client setup
├── pages/          # Page components
│   └── admin/      # Admin-only pages
├── stores/         # Zustand stores
└── types/          # TypeScript types
```

## Creating Admin Users

After deployment:
1. Register a new user through the app
2. Run this SQL in Supabase SQL Editor:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
UPDATE profiles SET credit_balance = 1000 WHERE email = 'your-email@example.com';
```

## License

MIT
