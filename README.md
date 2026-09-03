# Quality Management System

A full-stack ISO 9001 compliant Quality Management System built with Next.js 15 and Supabase.

## Features

- Create quality records (Nonconformities, Corrective Actions, Preventive Actions, Risks)
- Track status (Open, In Progress, Closed)
- Real-time dashboard with statistics
- Responsive modern UI with Tailwind CSS

## Tech Stack

- **Next.js 15** - React framework
- **Supabase** - Database & Backend
- **Tailwind CSS** - Styling
- **TypeScript** - Type safety

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials.

## Database Setup

The schema is in `supabase/schema.sql`. Run it in the Supabase SQL editor or via CLI:

```bash
supabase login
supabase init
supabase link --project-ref bikbzchtxtmccfoqmyol
supabase db push
```

## Deploy to Vercel

```bash
vercel
```
