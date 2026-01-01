
import asyncio
from qdrant_client import AsyncQdrantClient

async def main():
    client = AsyncQdrantClient(":memory:")
    print(client.query_points.__doc__)
    await client.close()

if __name__ == "__main__":
    asyncio.run(main())
