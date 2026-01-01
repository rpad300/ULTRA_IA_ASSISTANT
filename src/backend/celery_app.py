import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

# Redis URL from environment or default
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Initialize Celery
# We use Redis as both broker and backend for simplicity in this stack
celery_app = Celery(
    "knowledge_keeper",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["tasks.ingestion_tasks", "tasks.knowledge_tasks"]  # We will create this module next
)

# SOTA Configuration
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Resilience settings
    broker_connection_retry_on_startup=True,
    task_acks_late=True, # Ensure tasks are not lost if worker crashes
    worker_prefetch_multiplier=1, # Fair dispatch for long running tasks (like embedding)
)

if __name__ == "__main__":
    celery_app.start()
