# Project Sol

A modern Kanban task management app with cloud sync, built with React, TypeScript, and Supabase.

## Features

- 🎯 **Kanban Board**: Drag & drop task management with columns
- ☁️ **Cloud Sync**: Real-time synchronization across devices
- 🗂️ **Multiple Boards**: Create and switch between boards
- 🔐 **Authentication**: Google, Apple, and email sign-in
- 🎨 **Modern UI**: Beautiful, responsive design with dark/light themes
- ⌨️ **Keyboard Shortcuts**: Power user features for efficiency
- 📱 **Mobile Friendly**: Responsive design for all devices

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Real-time)
- **UI Components**: Framer Motion, Lucide React
- **Drag & Drop**: @dnd-kit

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account and project

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd tasksmint
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
```

Edit `.env` and add your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Supabase Setup

1. Create a new Supabase project
2. Enable Row Level Security (RLS)
3. Create the required tables:

```sql
-- Profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- App state table
CREATE TABLE app_state (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  state JSONB NOT NULL,
  last_write_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_state ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view own app state" ON app_state
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own app state" ON app_state
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own app state" ON app_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## Deployment

### Netlify

1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Add environment variables in Netlify dashboard
5. Deploy!

### Vercel

1. Import your GitHub repository
2. Vercel will auto-detect the Vite configuration
3. Add environment variables
4. Deploy!

## Build Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
