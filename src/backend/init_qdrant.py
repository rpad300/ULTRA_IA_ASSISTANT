from services.qdrant_service import get_qdrant_service

def init_qdrant():
    print("Initializing Qdrant...")
    try:
        service = get_qdrant_service()
        service.ensure_collection()
        print("Qdrant Initialized Successfully.")
    except Exception as e:
        print(f"Failed to initialize Qdrant: {e}")

if __name__ == "__main__":
    init_qdrant()
