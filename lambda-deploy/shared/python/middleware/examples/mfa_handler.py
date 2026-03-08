"""
Example Lambda handler demonstrating MFA integration
This shows how to handle MFA challenges in authentication flows
"""

import os
import json
import boto3
from botocore.exceptions import ClientError
from ..auth import create_auth_middleware


def protected_handler(event, context):
    """
    Example: Protected endpoint requiring MFA-authenticated users
    """
    auth_middleware = create_auth_middleware()
    auth_result = auth_middleware(event)

    if not auth_result['authorized']:
        return {
            'statusCode': 401,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({'error': 'Unauthorized', 'message': auth_result['error']}),
        }

    # Access user information
    user = event['user']

    # Check if user has MFA enabled (optional additional check)
    has_mfa = user['claims'].get('cognito:mfa_enabled') == 'true'

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps(
            {
                'message': 'Access granted',
                'user': {
                    'username': user['username'],
                    'email': user['email'],
                    'mfaEnabled': has_mfa,
                },
            }
        ),
    }


def mfa_status_handler(event, context):
    """
    Example: Endpoint to check MFA status
    """
    auth_middleware = create_auth_middleware()
    auth_result = auth_middleware(event)

    if not auth_result['authorized']:
        return {
            'statusCode': 401,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({'error': 'Unauthorized', 'message': auth_result['error']}),
        }

    user = event['user']

    # Extract MFA information from Cognito claims
    mfa_enabled = user['claims'].get('cognito:mfa_enabled') == 'true'
    preferred_mfa = user['claims'].get('cognito:preferred_mfa', 'NONE')

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps(
            {'mfaEnabled': mfa_enabled, 'preferredMfa': preferred_mfa, 'username': user['username']}
        ),
    }


def custom_auth_handler(event, context):
    """
    Example: Custom authentication flow with MFA handling
    This demonstrates how to handle MFA challenges in a custom auth flow
    """
    client = boto3.client('cognito-idp', region_name=os.environ.get('AWS_REGION', 'ap-south-1'))

    try:
        body = json.loads(event.get('body', '{}'))
        username = body.get('username')
        password = body.get('password')
        mfa_code = body.get('mfaCode')
        session = body.get('session')
        challenge_name = body.get('challengeName')

        # If MFA code is provided, respond to MFA challenge
        if mfa_code and session and challenge_name:
            response = client.respond_to_auth_challenge(
                ClientId=os.environ['COGNITO_CLIENT_ID'],
                ChallengeName=challenge_name,  # 'SMS_MFA' or 'SOFTWARE_TOKEN_MFA'
                Session=session,
                ChallengeResponses={
                    'USERNAME': username,
                    (
                        'SMS_MFA_CODE' if challenge_name == 'SMS_MFA' else 'SOFTWARE_TOKEN_MFA_CODE'
                    ): mfa_code,
                },
            )

            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                'body': json.dumps(
                    {'success': True, 'authenticationResult': response.get('AuthenticationResult')}
                ),
            }

        # Initial authentication
        response = client.initiate_auth(
            AuthFlow='USER_PASSWORD_AUTH',
            ClientId=os.environ['COGNITO_CLIENT_ID'],
            AuthParameters={'USERNAME': username, 'PASSWORD': password},
        )

        # Check if MFA challenge is required
        if response.get('ChallengeName') in ['SMS_MFA', 'SOFTWARE_TOKEN_MFA']:
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                'body': json.dumps(
                    {
                        'success': False,
                        'mfaRequired': True,
                        'challengeName': response['ChallengeName'],
                        'session': response['Session'],
                        'message': (
                            'MFA code sent to your phone'
                            if response['ChallengeName'] == 'SMS_MFA'
                            else 'Enter code from your authenticator app'
                        ),
                    }
                ),
            }

        # Authentication successful without MFA
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps(
                {'success': True, 'authenticationResult': response.get('AuthenticationResult')}
            ),
        }

    except ClientError as error:
        print(f'Authentication error: {error}')

        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({'error': 'Authentication failed', 'message': str(error)}),
        }


def sensitive_operation_handler(event, context):
    """
    Example: Require MFA for sensitive operations
    """
    auth_middleware = create_auth_middleware()
    auth_result = auth_middleware(event)

    if not auth_result['authorized']:
        return {
            'statusCode': 401,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({'error': 'Unauthorized', 'message': auth_result['error']}),
        }

    user = event['user']
    mfa_enabled = user['claims'].get('cognito:mfa_enabled') == 'true'

    # Require MFA for sensitive operations
    if not mfa_enabled:
        return {
            'statusCode': 403,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps(
                {
                    'error': 'MFA Required',
                    'message': 'This operation requires multi-factor authentication to be enabled',
                }
            ),
        }

    # Perform sensitive operation
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps({'message': 'Sensitive operation completed successfully'}),
    }
