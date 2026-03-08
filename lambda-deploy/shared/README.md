# Shared Utilities

Common utilities and libraries used across Lambda functions.

## Structure

```
shared/
├── python/              # Python shared code
│   ├── utils/          # Common utilities
│   ├── models/         # Data models
│   └── constants/      # Shared constants
└── nodejs/             # Node.js shared code
    ├── utils/          # Common utilities
    ├── models/         # Data models
    └── constants/      # Shared constants
```

## Usage

Shared code can be packaged as Lambda layers or included directly in function deployments.
