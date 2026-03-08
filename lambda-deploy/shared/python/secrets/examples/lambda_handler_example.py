"""
Example Lambda handlers demonstrating Secrets Manager usage
"""

import json
import requests
import jwt
from datetime import datetime, timedelta
from secrets_manager import get_instance


def abdm_handler(event, context):
    """
    Example: ABDM Connector Lambda using secrets
    """
    secrets_manager = get_instance()

    try:
        # Get ABDM credentials
        abdm_creds = secrets_manager.get_abdm_credentials()

        print(f"ABDM API Base URL: {abdm_creds['apiBaseUrl']}")

        # Use credentials to make API call
        response = requests.post(
            f"{abdm_creds['apiBaseUrl']}/v1/auth/token",
            json={
                "clientId": abdm_creds["clientId"],
                "clientSecret": abdm_creds["clientSecret"],
            },
            headers={"Content-Type": "application/json"},
        )

        data = response.json()

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Successfully authenticated with ABDM",
                    "token": data.get("token"),
                }
            ),
        }
    except Exception as e:
        print(f"Error: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps(
                {"error": "Failed to authenticate with ABDM", "message": str(e)}
            ),
        }


def voice_handler(event, context):
    """
    Example: Voice Processing Lambda using Bhashini credentials
    """
    secrets_manager = get_instance()

    try:
        # Get Bhashini credentials
        bhashini_creds = secrets_manager.get_bhashini_credentials()

        audio_data = event.get("audioData")
        language = event.get("language", "hi")

        # Use credentials to call Bhashini API
        response = requests.post(
            f"{bhashini_creds['apiBaseUrl']}/v1/transcribe",
            json={
                "audio": audio_data,
                "sourceLanguage": language,
                "targetLanguage": "en",
            },
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {bhashini_creds['apiKey']}",
                "User-Id": bhashini_creds["userId"],
            },
        )

        transcription = response.json()

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "transcription": transcription.get("text"),
                    "confidence": transcription.get("confidence"),
                }
            ),
        }
    except Exception as e:
        print(f"Error: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps(
                {"error": "Failed to transcribe audio", "message": str(e)}
            ),
        }


def bedrock_handler(event, context):
    """
    Example: Document Processing Lambda using Bedrock config
    """
    secrets_manager = get_instance()

    try:
        # Get Bedrock configuration
        bedrock_config = secrets_manager.get_bedrock_config()

        print(f"Using Bedrock model: {bedrock_config['modelId']}")

        # Use config for Bedrock API call
        # (Actual Bedrock SDK usage would go here)

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Bedrock config loaded successfully",
                    "modelId": bedrock_config["modelId"],
                }
            ),
        }
    except Exception as e:
        print(f"Error: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps(
                {"error": "Failed to load Bedrock config", "message": str(e)}
            ),
        }


def batch_secrets_handler(event, context):
    """
    Example: Batch loading multiple secrets
    """
    secrets_manager = get_instance()

    try:
        # Load multiple secrets at once
        secrets = secrets_manager.get_secrets(
            [
                "vaidyalink/dev/abdm/api-credentials",
                "vaidyalink/dev/bhashini/api-credentials",
                "vaidyalink/dev/bedrock/config",
            ]
        )

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Successfully loaded all secrets",
                    "secretsLoaded": len(secrets),
                }
            ),
        }
    except Exception as e:
        print(f"Error: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps(
                {"error": "Failed to load secrets", "message": str(e)}
            ),
        }


def jwt_handler(event, context):
    """
    Example: Using JWT signing secret
    """
    secrets_manager = get_instance()

    try:
        # Get JWT signing secret
        signing_secret = secrets_manager.get_jwt_signing_secret()

        # Create a JWT token
        token = jwt.encode(
            {
                "userId": event.get("userId"),
                "role": event.get("role"),
                "exp": datetime.utcnow() + timedelta(hours=1),
                "iss": "vaidyalink",
            },
            signing_secret,
            algorithm="HS256",
        )

        return {"statusCode": 200, "body": json.dumps({"token": token})}
    except Exception as e:
        print(f"Error: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps(
                {"error": "Failed to generate JWT", "message": str(e)}
            ),
        }


def refresh_secret_handler(event, context):
    """
    Example: Force refresh secret (useful for rotation)
    """
    secrets_manager = get_instance()

    try:
        # Force refresh from AWS (bypass cache)
        abdm_creds = secrets_manager.get_abdm_credentials()

        # Clear cache for specific secret
        secrets_manager.clear_cache("vaidyalink/dev/abdm/api-credentials")

        # Or clear all cache
        # secrets_manager.clear_cache()

        return {
            "statusCode": 200,
            "body": json.dumps({"message": "Secret refreshed successfully"}),
        }
    except Exception as e:
        print(f"Error: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps(
                {"error": "Failed to refresh secret", "message": str(e)}
            ),
        }


def database_handler(event, context):
    """
    Example: Using database credentials
    """
    secrets_manager = get_instance()

    try:
        # Get database credentials
        db_creds = secrets_manager.get_database_credentials()

        # Use credentials to connect to database
        # (Actual database connection would go here)

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Database credentials loaded successfully",
                    "username": db_creds.get("username"),
                }
            ),
        }
    except Exception as e:
        print(f"Error: {e}")
        return {
            "statusCode": 500,
            "body": json.dumps(
                {"error": "Failed to load database credentials", "message": str(e)}
            ),
        }
