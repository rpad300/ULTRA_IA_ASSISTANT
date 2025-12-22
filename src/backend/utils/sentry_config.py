"""
Sentry Configuration for Error Tracking
"""

import logging
import os
from config import ENVIRONMENT

logger = logging.getLogger(__name__)

# Try to import and initialize Sentry
try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration
    
    # SQLAlchemy integration is optional
    try:
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        sqlalchemy_integration = SqlalchemyIntegration()
    except Exception:
        sqlalchemy_integration = None
    
    SENTRY_DSN = os.getenv("SENTRY_DSN")
    
    if SENTRY_DSN and ENVIRONMENT == "production":
        integrations = [
            FastApiIntegration(),
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ]
        if sqlalchemy_integration:
            integrations.append(sqlalchemy_integration)
        
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=ENVIRONMENT,
            integrations=integrations,
            traces_sample_rate=0.1,  # 10% of transactions
            profiles_sample_rate=0.1,  # 10% of profiles
        )
        logger.info("Sentry initialized for error tracking")
        SENTRY_AVAILABLE = True
    else:
        logger.info("Sentry not configured (SENTRY_DSN not set or not in production)")
        SENTRY_AVAILABLE = False
except ImportError:
    logger.warning("Sentry SDK not installed. Error tracking disabled.")
    SENTRY_AVAILABLE = False
except Exception as e:
    logger.error(f"Failed to initialize Sentry: {e}")
    SENTRY_AVAILABLE = False

