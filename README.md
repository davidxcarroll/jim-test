# MLB Baseball Data Hub

A comprehensive MLB baseball data and analytics platform built with modern web technologies.

## 🏗️ Tech Stack

- **Frontend**: React + Next.js + Tailwind CSS + TypeScript
- **Backend**: Firebase (Auth + Firestore + Real-time listeners)
- **Data Management**: TanStack Query for ESPN API caching
- **State Management**: Zustand for client-side state
- **Validation**: Zod for forms and API data
- **Utilities**: date-fns for game schedules and timezones
- **Email**: Resend for automated weekly pick reminders
- **Deployment**: Vercel
- **Package Manager**: npm

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm
- Git

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd JIM-TEST
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env.local
```

4. Configure your environment variables in `.env.local` (see setup instructions below)

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## 🔧 Setup Instructions

### Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Authentication (Email/Password, Google, etc.)
4. Create a Firestore database
5. Get your Firebase config from Project Settings > General > Your apps
6. Add the config values to your `.env.local` file

### Resend Email Setup

1. Go to [Resend](https://resend.com/)
2. Create an account and verify your domain
3. Get your API key from the dashboard
4. Add `RESEND_API_KEY=your_key` to your `.env.local` file

### ESPN API

The project uses ESPN's public API for MLB data. No API key is required for basic functionality, but you may need one for advanced features.

## 📁 Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/         # React components
│   └── providers.tsx   # App providers
├── hooks/             # Custom React hooks
│   └── use-mlb-data.ts # MLB data hooks
├── lib/               # Utility libraries
│   ├── firebase.ts    # Firebase configuration
│   └── espn-api.ts    # ESPN API client
├── store/             # Zustand stores
│   └── auth-store.ts  # Authentication store
├── types/             # TypeScript types
│   └── mlb.ts         # MLB data types
└── utils/             # Utility functions
```

## 🎯 Features

- **Real-time Game Data**: Live scores and game updates from ESPN API
- **User Authentication**: Firebase Auth with multiple providers
- **Game Picks**: Users can make picks on games with confidence levels
- **Analytics Dashboard**: Advanced statistics and insights
- **Email Notifications**: Automated reminders via Resend
- **Responsive Design**: Mobile-first design with Tailwind CSS

## 🚀 Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Environment Variables for Production

Make sure to add all environment variables to your Vercel project settings.

## 📝 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License. 