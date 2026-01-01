
import asyncio
import os
import sys
import importlib.util

# Add backend to path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

async def run_script(script_name):
    print(f"\n\n{'='*20} Running {script_name} {'='*20}")
    try:
        # Load module dynamically
        spec = importlib.util.spec_from_file_location(script_name, script_name)
        module = importlib.util.module_from_spec(spec)
        sys.modules[script_name] = module
        spec.loader.exec_module(module)
        
        # Check for entry points
        entry_point = None
        if hasattr(module, 'main'):
            entry_point = module.main
        elif hasattr(module, 'verify_projects'):
            entry_point = module.verify_projects
            
        if entry_point:
            if asyncio.iscoroutinefunction(entry_point):
                await entry_point()
            else:
                entry_point()
        else:
            print(f"No entry point (main or verify_*) found in {script_name}")
            
    except Exception as e:
        print(f"FAILED {script_name}: {e}")
        import traceback
        traceback.print_exc()

async def main():
    print("STARTING FULL SOTA VERIFICATION SUITE")
    
    scripts = [
        "verify_drive_sota.py",
        "verify_enrollment.py",
        "verify_projects_endpoint.py"
    ]
    
    for s in scripts:
        await run_script(s)
        
    print("\n\nFULL SUITE COMPLETE")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
