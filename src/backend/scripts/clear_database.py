"""
Script para limpar todos os dados da base de dados Supabase
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from db.supabase_client import get_supabase_client

load_dotenv()

def clear_database():
    """Limpa todos os dados da base de dados."""
    supabase = get_supabase_client()
    
    print("🗑️  Limpando base de dados...")
    print("=" * 50)
    
    # Ordem de deleção (respeitando foreign keys)
    tables = [
        "dlq_embedding_failures",
        "embedding_index",
        "session_speakers",
        "messages",
        "sessions",
        "tasks",
        "threads",
        "contacts",
        "profiles",
        "projects",
        "user_companies",
        "companies"
    ]
    
    for table in tables:
        try:
            # Deletar todos os registros
            result = supabase.table(table).delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
            count = len(result.data) if result.data else 0
            print(f"✅ {table}: {count} registros removidos")
        except Exception as e:
            print(f"⚠️  {table}: Erro - {e}")
    
    print("=" * 50)
    print("✅ Base de dados limpa!")
    
    # Verificar contagens
    print("\n📊 Verificando contagens:")
    for table in tables:
        try:
            result = supabase.table(table).select("id", count="exact").limit(1).execute()
            count = result.count if hasattr(result, 'count') else 0
            print(f"  {table}: {count}")
        except:
            print(f"  {table}: N/A")

if __name__ == "__main__":
    confirm = input("⚠️  ATENÇÃO: Isto vai apagar TODOS os dados! Continuar? (sim/não): ")
    if confirm.lower() in ['sim', 's', 'yes', 'y']:
        clear_database()
    else:
        print("❌ Operação cancelada.")

