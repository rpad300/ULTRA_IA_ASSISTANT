
import asyncio
import sys
import os
from dotenv import load_dotenv, find_dotenv

# Env loading
env_file = find_dotenv(usecwd=True)
if env_file:
    print(f"Loading .env from: {env_file}")
    load_dotenv(env_file, override=True)

# Ensure backend imports work
sys.path.append(os.getcwd())

from services.prompt_service import prompt_service
from db.models import AIConfigUpdate

async def main():
    slug = "oracle_agent"
    print(f"--- Verifying PromptService for '{slug}' ---")

    # 1. Fetch Config (Should come from DB or Fallback, then Redis)
    config = await prompt_service.get_config(slug)
    print(f"1. Initial Fetch: Model={config.model_name}, Temp={config.temperature}")

    # 2. Render Prompt
    context_data = {"text": "Hello world", "context": "Test Context"}
    rendered = await prompt_service.render_prompt(slug, **context_data)
    print(f"2. Rendered Prompt Preview: {rendered[:50]}...")

    # 3. Update Config
    new_temp = 0.5
    print(f"3. Updating Temperature to {new_temp}...")
    updated = await prompt_service.update_config(slug, AIConfigUpdate(temperature=new_temp))
    print(f"   Update Result: Temp={updated.temperature}")

    # 4. Fetch Again (Should be updated)
    config_v2 = await prompt_service.get_config(slug)
    print(f"4. Refetch (Cache Verification): Temp={config_v2.temperature}")

    if config_v2.temperature == new_temp:
        print("SUCCESS: Configuration updated and retrieved correctly.")
    else:
        print("FAILURE: Configuration did not update correctly.")

    # Reset
    print("5. Resetting to 0.0...")
    await prompt_service.update_config(slug, AIConfigUpdate(temperature=0.0))
    print("Done.")

if __name__ == "__main__":
    asyncio.run(main())
