"""
AWS Secrets Manager utilities for VaidyaLink Python Lambda functions
"""

from .secrets_manager import SecretsManager, get_instance

__all__ = ["SecretsManager", "get_instance"]
