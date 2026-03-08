# VaidyaLink Vercel Deployment Guide

## Changes Made

1. **Homepage Redirect**: The root URL (`/`) now automatically redirects to `/vaidyalink/health-passport`
2. **UI Fixes**: All VaidyaLink pages converted from styled-jsx to CSS classes for proper styling
3. **Build Indicator**: Disabled Next.js build widget in development

## Deploy to Vercel

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository: `gusfing/VaidyaLink`
4. Configure the project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

5. Add Environment Variables (from `frontend/vercel.json`):

   ```
   NEXT_PUBLIC_API_URL=https://ptln3qd359.execute-api.ap-south-1.amazonaws.com/prod
   NEXT_PUBLIC_AWS_REGION=ap-south-1
   NEXT_PUBLIC_DEMO_MODE=true
   NEXT_PUBLIC_SKIP_AUTH=true
   ```

6. Click "Deploy"

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI globally
npm install -g vercel

# Navigate to frontend directory
cd frontend

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

The CLI will automatically detect the `vercel.json` configuration.

## Post-Deployment

After deployment, your site will be available at:

- Production: `https://your-project-name.vercel.app`
- The homepage will automatically redirect to the Health Passport page

## Verify Deployment

1. Visit your Vercel URL
2. You should be automatically redirected to `/vaidyalink/health-passport`
3. Test the navigation between pages:
   - Health Passport (home)
   - Records Library
   - Scanner
   - Voice Dashboard
   - Doctor Portal
   - Timeline

## Environment Variables

The following environment variables are configured in `vercel.json`:

- `NEXT_PUBLIC_API_URL`: AWS API Gateway endpoint
- `NEXT_PUBLIC_AWS_REGION`: AWS region (ap-south-1)
- `NEXT_PUBLIC_DEMO_MODE`: Enable demo mode (true)
- `NEXT_PUBLIC_SKIP_AUTH`: Skip authentication (true)

## Custom Domain (Optional)

To add a custom domain:

1. Go to your project in Vercel Dashboard
2. Navigate to Settings → Domains
3. Add your custom domain
4. Follow the DNS configuration instructions

## Troubleshooting

### Build Fails

- Check that all dependencies are in `frontend/package.json`
- Verify Node.js version compatibility (18.x or higher)
- Check build logs in Vercel Dashboard

### Environment Variables Not Working

- Ensure all `NEXT_PUBLIC_*` variables are set in Vercel Dashboard
- Redeploy after adding/changing environment variables

### Styling Issues

- All styles are now in `frontend/app/vaidyalink/vaidyalink.css`
- Clear browser cache if styles don't appear
- Check browser console for CSS loading errors

## Repository

GitHub: https://github.com/gusfing/VaidyaLink

## Support

For issues or questions:

1. Check Vercel deployment logs
2. Review Next.js build output
3. Verify environment variables are set correctly
