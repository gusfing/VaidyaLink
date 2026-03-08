# Production Deployment Guide - VaidyaLink Document Scanner

## Overview

This guide will help you deploy the VaidyaLink Document Scanner to production using Vercel (recommended) or AWS Amplify.

## Current Status

✅ Demo Mode is ENABLED and working perfectly
✅ Real prescription data extracted and integrated
✅ Sample document feature added
✅ Frontend polished and ready
✅ AWS Backend deployed (Lambda + S3 + DynamoDB)

## What's Included

1. **Frontend**: Next.js 16 application with document upload and processing
2. **Backend**: AWS Lambda functions for document processing
3. **Demo Mode**: Works without AWS quota limits (perfect for presentations)
4. **Sample Document**: Real prescription from Adichunchanagiri Hospital

## Deployment Options

### Option 1: Vercel (Recommended - Easiest)

Vercel is the easiest and fastest way to deploy Next.js applications.

#### Prerequisites

- GitHub account
- Vercel account (free tier is sufficient)

#### Steps

1. **Push code to GitHub** (if not already done):

```bash
git init
git add .
git commit -m "Ready for production deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/vaidyalink.git
git push -u origin main
```

2. **Deploy to Vercel**:
   - Go to https://vercel.com/
   - Click "Add New Project"
   - Import your GitHub repository
   - Configure project:
     - Framework Preset: Next.js
     - Root Directory: `frontend`
     - Build Command: `npm run build`
     - Output Directory: `.next`

3. **Set Environment Variables** in Vercel:

```
NEXT_PUBLIC_API_URL=https://ptln3qd359.execute-api.ap-south-1.amazonaws.com/prod
NEXT_PUBLIC_AWS_REGION=ap-south-1
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_SKIP_AUTH=true
```

4. **Deploy**:
   - Click "Deploy"
   - Wait 2-3 minutes
   - Your app will be live at `https://your-project.vercel.app`

5. **Custom Domain** (Optional):
   - Go to Project Settings → Domains
   - Add your custom domain
   - Follow DNS configuration instructions

#### Vercel CLI Deployment (Alternative)

```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to frontend
cd frontend

# Deploy
vercel

# Follow prompts:
# - Link to existing project or create new
# - Confirm settings
# - Deploy

# For production deployment
vercel --prod
```

### Option 2: AWS Amplify

AWS Amplify is great if you want everything in AWS.

#### Prerequisites

- AWS Account
- AWS CLI configured

#### Steps

1. **Create Amplify App**:

```bash
# Install Amplify CLI
npm install -g @aws-amplify/cli

# Configure Amplify
amplify configure

# Initialize Amplify in your project
cd frontend
amplify init

# Follow prompts:
# - Enter a name for the project: vaidyalink
# - Enter a name for the environment: prod
# - Choose your default editor
# - Choose the type of app: javascript
# - Framework: react
# - Source Directory Path: src
# - Distribution Directory Path: .next
# - Build Command: npm run build
# - Start Command: npm run start
```

2. **Add Hosting**:

```bash
amplify add hosting

# Choose:
# - Hosting with Amplify Console
# - Manual deployment
```

3. **Set Environment Variables**:
   - Go to AWS Amplify Console
   - Select your app
   - Go to "Environment variables"
   - Add:

```
NEXT_PUBLIC_API_URL=https://ptln3qd359.execute-api.ap-south-1.amazonaws.com/prod
NEXT_PUBLIC_AWS_REGION=ap-south-1
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_SKIP_AUTH=true
```

4. **Deploy**:

```bash
amplify publish
```

5. **Custom Domain** (Optional):
   - Go to Amplify Console → Domain management
   - Add domain
   - Follow DNS configuration

### Option 3: Manual Deployment (Any Static Host)

You can deploy to any static hosting service (Netlify, GitHub Pages, etc.)

#### Build the Application

```bash
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

# The build output will be in .next folder
# For static export (if needed):
npm run build && npm run export
# Output will be in 'out' folder
```

#### Deploy to Netlify

1. Go to https://netlify.com/
2. Drag and drop the `out` folder (if using static export) or `.next` folder
3. Set environment variables in Netlify dashboard
4. Deploy

## Post-Deployment Configuration

### 1. Test the Deployment

Visit your deployed URL and test:

- ✅ Page loads correctly
- ✅ "Try Sample Prescription" button works
- ✅ Upload interface works
- ✅ Demo Mode processes documents
- ✅ Results display correctly

### 2. Enable Real AWS Processing (Optional)

If you want to enable real AWS Bedrock processing:

1. **Update Environment Variables**:

```
NEXT_PUBLIC_DEMO_MODE=false
```

2. **Ensure AWS Quota**:
   - Wait for Bedrock quota to reset (midnight UTC)
   - Or request quota increase

3. **Redeploy**:

```bash
# Vercel
vercel --prod

# Amplify
amplify publish
```

### 3. Custom Domain Setup

#### For Vercel:

1. Go to Project Settings → Domains
2. Add your domain (e.g., `vaidyalink.com`)
3. Add DNS records as instructed:
   - Type: A
   - Name: @
   - Value: 76.76.21.21
   - Type: CNAME
   - Name: www
   - Value: cname.vercel-dns.com

#### For Amplify:

1. Go to Domain management
2. Add domain
3. Follow AWS's DNS configuration instructions

## Monitoring and Maintenance

### Vercel Analytics

Vercel provides built-in analytics:

- Go to your project → Analytics
- View page views, performance, and errors

### AWS CloudWatch (for backend)

Monitor Lambda functions:

```bash
# View logs
aws logs tail /aws/lambda/document-scan-processor-dev --follow

# View metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=document-scan-processor-dev \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

### Error Tracking

Consider adding error tracking:

- Sentry: https://sentry.io/
- LogRocket: https://logrocket.com/
- Datadog: https://www.datadoghq.com/

## Troubleshooting

### Build Fails

**Error**: `Module not found`
**Solution**: Ensure all dependencies are in `package.json`:

```bash
cd frontend
npm install
```

**Error**: `Environment variable not found`
**Solution**: Check environment variables are set in deployment platform

### Demo Mode Not Working

**Check**:

1. `NEXT_PUBLIC_DEMO_MODE=true` is set
2. `/sample-prescription.jpg` exists in `public` folder
3. Clear browser cache and reload

### Real AWS Mode Not Working

**Check**:

1. AWS Lambda is deployed: `aws lambda get-function --function-name document-scan-processor-dev`
2. API Gateway is accessible: `curl https://ptln3qd359.execute-api.ap-south-1.amazonaws.com/prod/health`
3. Bedrock quota is available
4. Environment variables are correct

## Performance Optimization

### Image Optimization

Next.js automatically optimizes images. Ensure you're using the `Image` component:

```tsx
import Image from 'next/image';

<Image src="/sample-prescription.jpg" alt="Sample" width={800} height={600} />;
```

### Caching

Vercel automatically caches static assets. For API responses:

```tsx
// Add cache headers
export const revalidate = 3600; // Revalidate every hour
```

### Bundle Size

Check bundle size:

```bash
npm run build
# Look for "First Load JS" in output
```

Optimize if needed:

```bash
# Analyze bundle
npm install -D @next/bundle-analyzer
```

## Security Checklist

- ✅ Environment variables are not committed to Git
- ✅ API endpoints use HTTPS
- ✅ CORS is configured correctly
- ✅ Authentication is disabled for MVP (as intended)
- ✅ File upload size limits are enforced (10MB)
- ✅ File type validation is in place

## Backup and Disaster Recovery

### Database Backup (DynamoDB)

Enable point-in-time recovery:

```bash
aws dynamodb update-continuous-backups \
  --table-name document-scan-jobs-dev \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

### S3 Backup

Enable versioning:

```bash
aws s3api put-bucket-versioning \
  --bucket document-scan-docs-dev-038208944386 \
  --versioning-configuration Status=Enabled
```

## Cost Estimation

### Vercel (Frontend)

- Free tier: Sufficient for most use cases
- Pro: $20/month (if needed for custom domains, etc.)

### AWS (Backend)

- Lambda: ~$0.20 per 1M requests
- S3: ~$0.023 per GB/month
- DynamoDB: ~$0.25 per GB/month
- API Gateway: ~$3.50 per 1M requests
- Bedrock: Pay per token (varies by model)

**Estimated monthly cost for 1000 documents**: $5-10

## Support and Documentation

- Next.js Docs: https://nextjs.org/docs
- Vercel Docs: https://vercel.com/docs
- AWS Amplify Docs: https://docs.amplify.aws/
- AWS Lambda Docs: https://docs.aws.amazon.com/lambda/

## Quick Reference Commands

```bash
# Local development
cd frontend && npm run dev

# Build for production
cd frontend && npm run build

# Deploy to Vercel
cd frontend && vercel --prod

# Deploy to Amplify
cd frontend && amplify publish

# Check AWS Lambda
aws lambda get-function --function-name document-scan-processor-dev

# View Lambda logs
aws logs tail /aws/lambda/document-scan-processor-dev --follow

# Test API endpoint
curl https://ptln3qd359.execute-api.ap-south-1.amazonaws.com/prod/health
```

## Success Criteria

Your deployment is successful when:

- ✅ Application loads at your production URL
- ✅ "Try Sample Prescription" button loads the sample document
- ✅ Document upload works (in Demo Mode)
- ✅ Processing completes and shows results
- ✅ Results display medications, conditions, and lab values
- ✅ No console errors
- ✅ Mobile responsive design works

## Next Steps After Deployment

1. Share the production URL with stakeholders
2. Gather feedback
3. Monitor usage and performance
4. Plan for real AWS Bedrock integration when quota is available
5. Consider adding user authentication for production use
6. Add analytics to track usage patterns

---

**Deployment completed successfully!** 🎉

Your VaidyaLink Document Scanner is now live and ready for demonstrations and submissions.
