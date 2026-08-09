import asyncio
import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from app.services.diagnostics import _pool_stats, _onnx_stats, _scheduler_stats, _system_stats
from app.db.session import engine
from sqlalchemy import text

async def test():
    print("testing pool stats")
    try:
        print(_pool_stats())
    except Exception as e: print(f"Error pool: {e}")

    print("testing onnx stats")
    try:
        print(_onnx_stats())
    except Exception as e: print(f"Error onnx: {e}")
    
    print("testing system stats")
    try:
        print(_system_stats())
    except Exception as e: print(f"Error system: {e}")
    
    print("testing scheduler stats")
    try:
        print(await _scheduler_stats())
    except Exception as e: print(f"Error scheduler: {e}")
    
    print("testing db roundtrip")
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            print("DB success")
    except Exception as e: print(f"Error db: {e}")

if __name__ == "__main__":
    asyncio.run(test())
