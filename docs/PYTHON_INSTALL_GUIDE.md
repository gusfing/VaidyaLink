# Python Installation Guide for Lambda Packaging

## Quick Install Steps

### Option 1: Using Windows Store (Recommended - Fastest)

1. Press `Windows + S` and search for "Microsoft Store"
2. Search for "Python 3.11"
3. Click "Get" or "Install"
4. Wait 2-3 minutes for installation
5. Open a NEW PowerShell window and verify: `python --version`

### Option 2: Using Official Installer

1. Go to: https://www.python.org/downloads/
2. Download "Python 3.11.x" (latest 3.11 version)
3. Run the installer
4. **IMPORTANT**: Check "Add Python to PATH" during installation
5. Click "Install Now"
6. Wait 2-3 minutes
7. Open a NEW PowerShell window and verify: `python --version`

### Option 3: Using Chocolatey (If you have it)

```powershell
choco install python311 -y
```

## After Python is Installed

1. **Open a NEW PowerShell window** (important - to pick up PATH changes)

2. **Verify Python is installed**:

   ```powershell
   python --version
   pip --version
   ```

3. **Package the Lambda**:

   ```powershell
   cd C:\Users\ks209\Downloads\VaidyaLink\backend\document-processor
   ./package.ps1
   ```

4. **Deploy to AWS**:

   ```powershell
   aws lambda update-function-code --function-name document-scan-processor-dev --zip-file fileb://document-processor-lambda.zip --region ap-south-1
   ```

5. **Wait 30 seconds** for Lambda to update

6. **Switch frontend to real mode**:
   - Edit `frontend/.env.local`
   - Change `NEXT_PUBLIC_DEMO_MODE=true` to `NEXT_PUBLIC_DEMO_MODE=false`
   - Restart frontend: Stop and start `npm run dev`

7. **Test with real document**!

## Estimated Time

- Python installation: 3-5 minutes
- Lambda packaging: 2 minutes
- Lambda deployment: 1 minute
- **Total: ~10 minutes**

## Need Help?

If you get stuck, let me know at which step and I'll help you troubleshoot.
