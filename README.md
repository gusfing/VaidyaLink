# VaidyaLink: Bridging the Paper-Gap in Bharat's Healthcare with Generative AI

> Transforming India's "Dark Data" into globally interoperable digital health records using AWS AI and serverless architecture.

[![AWS AI for Bharat Hackathon](https://img.shields.io/badge/AWS-AI%20for%20Bharat-orange)](https://aws.amazon.com)
[![ABDM Compliant](https://img.shields.io/badge/ABDM-Compliant-green)](https://abdm.gov.in)
[![HL7 FHIR](https://img.shields.io/badge/HL7-FHIR%20R4-blue)](https://www.hl7.org/fhir/)

---

## 🎯 Project Inspiration

India's healthcare system faces a critical challenge: **billions of medical records exist only on paper**, locked away in handwritten prescriptions, clinic files, and patient diaries. This "Dark Data" creates:

- **Fragmented Care**: Patients carry physical files between hospitals, losing critical history
- **Medical Tourism Barriers**: International providers cannot access Indian medical records
- **Rural Healthcare Gaps**: Non-literate patients struggle to communicate their health history
- **Emergency Delays**: Doctors waste precious minutes deciphering handwritten notes

**VaidyaLink** solves this by digitizing messy, handwritten Indian medical records into structured, globally interoperable HL7 FHIR data—compliant with the Ayushman Bharat Digital Mission (ABDM).

---

## 🚀 How It Works

### Step 1: 📸 Capture
Mobile-first scanning of physical prescriptions, lab reports, and handwritten notes using any smartphone camera.

### Step 2: 🤖 Process
Serverless AI pipeline powered by:
- **Amazon Bedrock (Claude 3.5 Sonnet)** for clinical reasoning and summarization
- **Bhashini API** for multilingual voice-to-text in 22 Indian languages
- **PaddleOCR** for handwritten medical text extraction

### Step 3: 🌐 Standardize
Automated conversion to:
- **HL7 FHIR R4** format for global interoperability
- **ABDM-compliant** records linked to ABHA ID
- **Consent Manager** integration for patient data control

---

## ✨ Key Features

### 🖋️ Vision-OCR: Deciphering Indian Medical Handwriting
High-accuracy extraction from handwritten prescriptions in multiple Indian languages and scripts (Devanagari, Tamil, Bengali, etc.)

### 🗣️ Multilingual Voice: Voice-Driven Health History for Bharat
Non-literate patients can speak their medical history in their native language—powered by Bhashini's speech-to-text API.

### 📋 Clinical Flash Dashboard: 30-Second Summaries
Doctors get AI-generated clinical summaries in under 30 seconds, reducing consultation time and improving care quality.

### 🌍 Global Passport: Portable Records for Medical Tourism
One-click export of complete medical history in HL7 FHIR format, enabling seamless care abroad.

### 🔒 Privacy-First Architecture
End-to-end encryption with AWS KMS, HIPAA-eligible infrastructure, and ABDM consent framework compliance.

### 💰 Cost-Efficient: Pay-Per-Scan Model
Serverless architecture ensures zero idle costs—approximately ₹0.40 per record processed.

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 14 (App Router) | Progressive Web App (PWA) for mobile-first experience |
| | AWS Amplify | Hosting, CI/CD, and authentication |
| **Backend** | AWS Lambda (Node.js/Python) | Serverless compute for AI processing |
| | Amazon API Gateway | RESTful API management |
| **AI Engine** | Amazon Bedrock (Claude 3.5 Sonnet) | Clinical reasoning and summarization |
| | Bhashini API | Multilingual speech-to-text (22 languages) |
| | PaddleOCR | Handwritten text extraction |
| **Storage** | Amazon S3 | Raw image storage with lifecycle policies |
| | AWS HealthLake | FHIR-compliant data store |
| | Amazon DynamoDB | Metadata and user session management |
| **Security** | AWS KMS | End-to-end encryption |
| | Amazon Cognito | User authentication and ABHA ID integration |
| **Monitoring** | Amazon CloudWatch | Logging and performance metrics |
| | AWS X-Ray | Distributed tracing |

---

## 📦 Installation & Local Setup

### Prerequisites
- Node.js 18+ and npm/yarn
- AWS Account with Amplify CLI configured
- Python 3.9+ (for Lambda functions)

### Clone the Repository
```bash
git clone https://github.com/[your-username]/vaidyalink.git
cd vaidyalink
```

### Install Dependencies
```bash
# Frontend
npm install

# Backend (Lambda functions)
cd lambda
pip install -r requirements.txt
cd ..
```

### Configure AWS Amplify
```bash
amplify init
amplify push
```

### Set Environment Variables
Create a `.env.local` file:
```env
NEXT_PUBLIC_API_ENDPOINT=your-api-gateway-url
NEXT_PUBLIC_BHASHINI_API_KEY=your-bhashini-key
AWS_REGION=ap-south-1
```

### Run Development Server
```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

---

## 🏗️ Architecture Overview

```
┌─────────────┐
│   Patient   │
│  (Mobile)   │
└──────┬──────┘
       │ Upload Image
       ▼
┌─────────────────┐
│  AWS Amplify    │
│  (Next.js PWA)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API Gateway    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  Lambda Trigger │─────▶│   S3 Bucket  │
│  (Orchestrator) │      │ (Raw Images) │
└────────┬────────┘      └──────────────┘
         │
         ▼
┌─────────────────────────────────┐
│     AI Processing Pipeline      │
│  ┌───────────────────────────┐  │
│  │ 1. PaddleOCR Extraction   │  │
│  │ 2. Bhashini Translation   │  │
│  │ 3. Bedrock Summarization  │  │
│  │ 4. FHIR Transformation    │  │
│  └───────────────────────────┘  │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────┐
│  AWS HealthLake │
│  (FHIR Store)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Patient Portal  │
│   & Dashboard   │
└─────────────────┘
```

---

## 🌟 Social Impact & Future Vision

### Reaching 1.4 Billion People
VaidyaLink is designed to scale across India's diverse healthcare landscape—from metro hospitals to rural primary health centers (PHCs).

### Digital Infrastructure for Smart Health Districts
Our vision extends beyond individual records:
- **Population Health Analytics**: Aggregate anonymized data for disease surveillance
- **Telemedicine Integration**: Enable remote consultations with complete patient history
- **Emergency Response**: Instant access to critical medical information during disasters

### Empowering the Next Billion Users
By supporting 22 Indian languages and voice interfaces, we ensure healthcare digitization reaches every citizen—regardless of literacy or technical skills.

---

## 🤝 Team & Recognition

**Project Lead**: Kunal Sharma  
**Co-Founder**: [Name]

Built for the **AWS AI for Bharat Hackathon** with a mission to democratize healthcare access across India.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **AWS** for providing the serverless infrastructure and AI capabilities
- **Bhashini** for enabling multilingual voice interfaces
- **ABDM** for establishing India's digital health standards
- **Open-source community** for tools like PaddleOCR and Next.js

---

## 📞 Contact & Support

For questions, feedback, or collaboration opportunities:
- **Email**: [contact@vaidyalink.in]
- **GitHub Issues**: [Report bugs or request features](https://github.com/[your-username]/vaidyalink/issues)
- **Twitter**: [@VaidyaLink]

---

<p align="center">
  <strong>Made with ❤️ for Bharat's Healthcare Revolution</strong>
</p>
