# Deploy to Railway

This guide will help you deploy the Replicate BG Comparison app to Railway.

## Prerequisites

- Railway account (sign up at https://railway.app)
- Replicate API key (get one at https://replicate.com)

## Deployment Steps

### Option 1: Using Railway CLI (Recommended)

1. **Login to Railway** (you'll need to do this in your terminal):
   ```bash
   railway login
   ```
   This will open a browser window for authentication.

2. **Navigate to the project directory**:
   ```bash
   cd /Users/ilan/.gemini/antigravity/scratch/replicate-bg-comparison
   ```

3. **Initialize Railway project**:
   ```bash
   railway init
   ```
   - Select "Create new project"
   - Give it a name like "replicate-bg-comparison"

4. **Deploy the app**:
   ```bash
   railway up
   ```

5. **Add a domain**:
   ```bash
   railway domain
   ```
   This will generate a public URL for your app.

6. **Done!** Your app should be live at the generated URL.

### Option 2: Using Railway Dashboard

1. Go to https://railway.app/new

2. Click "Deploy from GitHub repo"

3. Push this code to GitHub first:
   ```bash
   cd /Users/ilan/.gemini/antigravity/scratch/replicate-bg-comparison
   gh repo create replicate-bg-comparison --public --source=. --push
   ```

4. Select the repository in Railway

5. Railway will automatically detect the configuration and deploy

6. Add a domain in the Railway dashboard settings

## Important Notes

- **No environment variables needed on Railway** - Users will enter their Replicate API key directly in the web interface
- The app stores API keys in browser localStorage for convenience
- The Express server proxies all Replicate API requests to avoid CORS issues

## Project Structure

- `src/` - React frontend source code
- `server.js` - Express backend for production
- `dist/` - Built frontend files (generated during deployment)
- `railway.json` - Railway deployment configuration

## How It Works

1. Railway builds the Vite app (`npm run build`)
2. Starts the Express server (`node server.js`)
3. Express serves the static files from `dist/`
4. Express proxies `/replicate/*` requests to Replicate API
5. Users access the app and enter their API key in the settings

## Local Development

To run locally:
```bash
npm install
npm run dev
```

This uses Vite's dev server with proxy configured in `vite.config.js`.
