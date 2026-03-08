# VaidyaLink Dependencies Summary

This document summarizes all dependencies configured for the VaidyaLink project as part of Task 1.6.

## Root Package (Monorepo)

**Location**: `package.json`

### Dev Dependencies

- **Code Quality**: ESLint, Prettier, Prettier Tailwind plugin
- **Git Hooks**: Husky, lint-staged
- **Commit Standards**: Commitlint with conventional config
- **TypeScript**: TypeScript compiler and ESLint plugin
- **Build Tools**: Configured for pnpm workspaces

## Frontend (Next.js 14)

**Location**: `frontend/package.json`

### Production Dependencies

- **Framework**: Next.js 16.1.6, React 19.2.3
- **State Management**:
  - TanStack Query (server state)
  - Zustand (client state)
- **UI Components**:
  - Radix UI primitives (Dialog, Dropdown, Select, Toast, Tabs)
  - shadcn/ui utilities (CVA, clsx, tailwind-merge)
  - Lucide React (icons)
- **Forms**: React Hook Form with Zod validation
- **Internationalization**: next-i18next
- **PWA**: next-pwa
- **HTTP Client**: Axios
- **Utilities**: date-fns

### Dev Dependencies

- **Styling**: Tailwind CSS 4, PostCSS
- **TypeScript**: Full type support for React and Node
- **Testing**:
  - Jest with React Testing Library
  - Playwright for E2E tests
- **Code Quality**: ESLint, Prettier
- **Build**: React Compiler plugin

## Infrastructure (AWS CDK)

**Location**: `infrastructure/package.json`

### Production Dependencies

- **AWS CDK**: aws-cdk-lib 2.110.0
- **Constructs**: constructs 10.3.0
- **Configuration**: dotenv for environment variables

### Dev Dependencies

- **TypeScript**: Full TypeScript support with ts-node
- **Testing**: Jest with ts-jest
- **Code Quality**: ESLint with TypeScript support, Prettier
- **AWS CDK CLI**: aws-cdk for deployments

## Backend Lambda Functions

### Node.js Lambdas (Node.js 18)

#### 1. Voice Processing Lambda

**Location**: `backend/voice-processing/package.json`

**Dependencies**:

- AWS SDK v2 and v3 (S3, DynamoDB, Bedrock Runtime)
- Axios (for Bhashini API calls)
- DynamoDB Document Client

**Purpose**: Transcribe voice recordings using Bhashini API and structure data with Bedrock

#### 2. ABDM Connector Lambda

**Location**: `backend/abdm-connector/package.json`

**Dependencies**:

- AWS SDK v2 and v3 (S3, DynamoDB)
- Axios (for ABDM API calls)
- jsonwebtoken (for JWT handling)
- DynamoDB Document Client

**Purpose**: Integrate with ABDM for ABHA ID authentication and consent management

#### 3. HITL Handler Lambda

**Location**: `backend/hitl-handler/package.json`

**Dependencies**:

- AWS SDK v2 and v3 (S3, DynamoDB, SQS)
- DynamoDB Document Client

**Purpose**: Manage human-in-the-loop verification workflow

### Python Lambdas (Python 3.11)

#### 1. Document Processing Lambda

**Location**: `backend/document-processing/requirements.txt`

**Dependencies**:

- **AWS**: boto3, botocore
- **OCR**: PaddleOCR, PaddlePaddle
- **Image Processing**: Pillow, OpenCV (headless), NumPy
- **AI**: Anthropic (for Bedrock)
- **Testing**: pytest, pytest-cov, pytest-mock, moto

**Purpose**: Extract text from medical documents using OCR and structure with Bedrock

#### 2. Clinical Summarizer Lambda

**Location**: `backend/clinical-summarizer/requirements.txt`

**Dependencies**:

- **AWS**: boto3, botocore
- **AI**: Anthropic (for Bedrock)
- **FHIR**: fhir.resources (for querying HealthLake)
- **Testing**: pytest, pytest-cov, pytest-mock, moto

**Purpose**: Generate 30-second clinical summaries using Claude 3.5 Sonnet

#### 3. FHIR Transformer Lambda

**Location**: `backend/fhir-transformer/requirements.txt`

**Dependencies**:

- **AWS**: boto3, botocore
- **FHIR**: fhir.resources, fhirclient
- **HTTP**: requests (for code system mapping)
- **Testing**: pytest, pytest-cov, pytest-mock, moto

**Purpose**: Convert structured data to HL7 FHIR R4 format and store in HealthLake

## Key Technology Decisions

### Frontend

- **Next.js 14 App Router**: Modern React framework with server components
- **TanStack Query**: Powerful server state management with caching
- **Zustand**: Lightweight client state management
- **Radix UI**: Accessible, unstyled UI primitives for shadcn/ui
- **Tailwind CSS 4**: Utility-first CSS framework

### Backend

- **Node.js 18**: For API-heavy Lambdas (voice, ABDM, HITL)
- **Python 3.11**: For AI/ML-heavy Lambdas (OCR, summarization, FHIR)
- **AWS SDK v3**: Modern, modular AWS SDK for Node.js
- **boto3**: Standard AWS SDK for Python

### Infrastructure

- **AWS CDK**: Infrastructure as Code with TypeScript
- **Monorepo**: pnpm workspaces for efficient dependency management

## Installation

To install all dependencies:

```bash
# Install root and all workspace dependencies
pnpm install

# Install Python dependencies for each Lambda
pip install -r backend/document-processing/requirements.txt
pip install -r backend/clinical-summarizer/requirements.txt
pip install -r backend/fhir-transformer/requirements.txt
```

## Next Steps

- Task 1.7: Set up pnpm workspaces for monorepo management
- Task 2.1: Initialize AWS CDK project for infrastructure
- Task 7.1: Create DynamoDB tables
- Task 8.1: Implement Document Processing Lambda
