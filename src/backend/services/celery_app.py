"""
Celery Configuration for Background Jobs
"""

import os
from celery import Celery
from config import ENVIRONMENT

# Redis URL for Celery broker and result backend
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "ultra_assistant",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["services.tasks"]
)

# Celery configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes
    task_soft_time_limit=25 * 60,  # 25 minutes
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1000,
    
    # SOTA Resilience & Reliability
    task_acks_late=True, # Prevent data loss if worker crashes
    task_reject_on_worker_lost=True, # Re-queue if worker dies
    broker_connection_retry_on_startup=True, # Cloud-native resilience
    
    # Memory Management
    result_expires=3600, # 1 Hour TTL to prevent Redis leaks
    
    # Performance
    task_compression='gzip', # Efficient for large transcripts/embeddings
)

# Task routing
celery_app.conf.task_routes = {
    "services.tasks.generate_embedding": {"queue": "embeddings"},
    "services.tasks.process_transcription": {"queue": "transcriptions"},
    "services.tasks.sync_to_vector": {"queue": "vector_sync"},
}





