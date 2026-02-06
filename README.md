# 🏎️ TuneForge - ECU Tuning Platform (Supabase Edition)

A modern, production-ready ECU tuning file service platform built with **React + Supabase**. Simple to deploy, easy to manage!

## ✨ Features

### Client Portal
- 🔐 Secure authentication (Supabase Auth)
- 📤 Drag-and-drop ECU file upload
- 🚗 Vehicle information management
- 🛠️ Service selection (Stage 1/2, DPF, EGR, AdBlue, etc.)
- 📊 Real-time job status tracking
- 📥 Modified file download
- 💳 Credit-based billing
- 💬 Job messaging

### Admin Dashboard
- 📋 Job queue management
- 👥 User management
- 💰 Credit adjustments
- 📈 Statistics

### Built-in Security
- Row Level Security (RLS)
- Secure file storage
- Role-based access control

## 🚀 Quick Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be ready

### 2. Run Database Schema

1. Go to **SQL Editor** in your Supabase dashboard
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`
3. Run the SQL

### 3. Create Storage Bucket

1. Go to **Storage** in Supabase dashboard
2. Create a new bucket called `ecu-files`
3. Set it to **private**
4. Add these storage policies:

```sql
-- Allow authenticated users to upload to their job folders
CREATE POLICY "Users can upload files" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ecu-files');

-- Allow users to read files from their jobs
CREATE POLICY "Users can read own files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'ecu-files');

-- Allow admins full access
CREATE POLICY "Admins full access" ON storage.objects
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);
```

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
- `VITE_SUPABASE_URL` - Your project URL
- `VITE_SUPABASE_ANON_KEY` - Your anon/public key

Find these in: **Settings > API** in Supabase dashboard

### 5. Install & Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 🎉

## 📁 Project Structure

```
ecu-tuning-platform/
├── src/
│   ├── components/     # UI components
│   ├── hooks/          # Supabase data hooks
│   ├── lib/            # Supabase client
│   ├── pages/          # Page components
│   ├── stores/         # Zustand stores
│   └── types/          # TypeScript types
├── supabase/
│   └── migrations/     # SQL schema
└── package.json
```

## 🔧 Configuration

### Create Admin User

After registering, update your user role in SQL Editor:

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your@email.com';
```

### Service Pricing

Edit services in SQL Editor:

```sql
UPDATE services 
SET base_price = 200 
WHERE code = 'stage1';
```

### Add Credits to User

```sql
SELECT admin_add_credits(
  'user-uuid-here',
  500.00,
  'Initial credit bonus'
);
```

## 📊 Database Schema

### Main Tables
- `profiles` - User profiles (extends auth.users)
- `jobs` - Tuning job records
- `job_services` - Services per job
- `files` - File metadata
- `transactions` - Credit transactions
- `services` - Available services

### Key Functions
- `create_job_with_services()` - Create job & deduct credits
- `update_job_status()` - Admin status updates
- `admin_add_credits()` - Add credits to users
- `request_job_revision()` - Client revision requests

## 🔒 Security

### Row Level Security
All tables have RLS policies:
- Clients can only see/edit their own data
- Admins can see/edit everything
- Files are protected by storage policies

### Authentication
- Supabase Auth handles all auth
- JWT tokens auto-refreshed
- Session persistence

## 🚀 Deploy to Production

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy!

### Netlify

```bash
npm run build
# Upload dist/ folder
```

## 📝 Customization

### Add New Service

```sql
INSERT INTO services (category_id, code, name, description, base_price, icon)
VALUES (
  (SELECT id FROM service_categories WHERE name = 'Performance Tuning'),
  'stage3',
  'Stage 3',
  'Maximum power for race applications',
  500.00,
  'rocket'
);
```

### Change Theme Colors

Edit `tailwind.config.js` - the primary color is red-600.

## 🆘 Troubleshooting

### "Invalid API key"
- Check your `.env` file
- Make sure you're using the correct anon key

### "Permission denied"
- Check RLS policies
- Make sure user role is correct

### Files not uploading
- Check storage bucket policies
- Verify bucket name is `ecu-files`

## 📄 License

MIT License

---

Built with ❤️ using React, Supabase, and TailwindCSS
