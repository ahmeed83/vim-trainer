# Vim Trainer

An interactive web application to practice and master Vim skills. Built with TypeScript, Vite, and deployed on Vercel.

**Live Demo:** https://vim-trainer-nine.vercel.app

## Features

- **15 Interactive Lessons** covering essential Vim commands:
  - Basic movement (h, j, k, l)
  - Word navigation (w, b, e)
  - Line movement (0, $, ^)
  - File navigation (gg, G)
  - Insert mode (i, a, o, O, I, A)
  - Delete commands (x, dd, dw)
  - Change commands (c, cc, cw)
  - Copy & paste (yy, p, P)
  - Visual mode (v, V)
  - Search (/, n, N)
  - And more...

- **Sandbox Mode** - Free practice area with no restrictions
- **Command Reference** - Quick lookup for all Vim commands
- **Progress Tracking** - Your progress is saved locally
- **Premium Model** - First 3 lessons free, unlock all with Stripe checkout

## Tech Stack

- TypeScript
- Vite
- Stripe (payments)
- Vercel (hosting)

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/vim-trainer.git
   cd vim-trainer
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 in your browser

### Build

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Deployment

### Deploy to Vercel

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

### Enable Stripe Payments

1. Create a Stripe account at https://stripe.com

2. Get your API keys from https://dashboard.stripe.com/apikeys

3. Add the environment variable in Vercel:
   - Go to Project Settings → Environment Variables
   - Add `STRIPE_SECRET_KEY` with your Stripe secret key

4. Redeploy to apply:
   ```bash
   vercel --prod
   ```

## Project Structure

```
vim-trainer/
├── api/
│   └── create-checkout-session.ts  # Stripe checkout endpoint
├── src/
│   ├── main.ts          # Main application logic
│   ├── vim-engine.ts    # Vim command interpreter
│   ├── lessons.ts       # Lesson definitions
│   ├── types.ts         # TypeScript type definitions
│   └── styles.css       # Styling
├── index.html           # Main HTML file
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vercel.json          # Vercel configuration
```

## License

MIT
