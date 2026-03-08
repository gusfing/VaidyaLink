"""
Logging utilities for FHIR Transformer
"""

import logging
import json
from typing import Any, Dict, Optional
from datetime import datetime


class FHIRLogger:
    """Custom logger for FHIR Transformer with structured logging"""

    def __init__(self, name: str, level: str = 'INFO'):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(getattr(logging, level.upper()))

    def _format_message(self, message: str, context: Optional[Dict[str, Any]] = None) -> str:
        """Format log message with context"""
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'message': message
        }

        if context:
            log_entry['context'] = context

        return json.dumps(log_entry)

    def info(self, message: str, **context):
        """Log info message"""
        self.logger.info(self._format_message(message, context))

    def error(self, message: str, **context):
        """Log error message"""
        self.logger.error(self._format_message(message, context))

    def warning(self, message: str, **context):
        """Log warning message"""
        self.logger.warning(self._format_message(message, context))

    def debug(self, message: str, **context):
        """Log debug message"""
        self.logger.debug(self._format_message(message, context))


def get_logger(name: str = 'fhir-transformer') -> FHIRLogger:
    """Get a configured logger instance"""
    import os
    log_level = os.environ.get('LOG_LEVEL', 'INFO')
    return FHIRLogger(name, log_level)
