"""
Verify JWT Configuration
Quick script to verify SUPABASE_JWT_SECRET is configured correctly
"""

from config import SUPABASE_JWT_SECRET, ENVIRONMENT
import os

def verify_jwt_config():
    """Verify JWT secret configuration."""
    print("=" * 50)
    print("Verificando Configuração do JWT Secret")
    print("=" * 50)
    print()
    
    # Check if secret is set
    if SUPABASE_JWT_SECRET:
        print("✅ SUPABASE_JWT_SECRET está configurado!")
        print(f"   Tamanho: {len(SUPABASE_JWT_SECRET)} caracteres")
        print(f"   Primeiros 10 caracteres: {SUPABASE_JWT_SECRET[:10]}...")
        print()
        print("✅ O middleware de autenticação usará validação JWT direta")
        print("   (mais rápido e eficiente)")
    else:
        print("⚠️  SUPABASE_JWT_SECRET não está configurado")
        print()
        print("   O middleware usará Supabase client para validação")
        print("   (funciona, mas é mais lento)")
        print()
        print("   Para configurar, adicione ao .env:")
        print("   SUPABASE_JWT_SECRET=your_jwt_secret_here")
    
    print()
    print(f"Ambiente: {ENVIRONMENT}")
    print()
    print("=" * 50)
    
    # Check .env file
    env_file = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(env_file):
        print(f"✅ Arquivo .env encontrado: {env_file}")
        with open(env_file, 'r') as f:
            content = f.read()
            if "SUPABASE_JWT_SECRET" in content:
                print("✅ SUPABASE_JWT_SECRET encontrado no .env")
            else:
                print("⚠️  SUPABASE_JWT_SECRET não encontrado no .env")
    else:
        print(f"⚠️  Arquivo .env não encontrado: {env_file}")
    
    print("=" * 50)


if __name__ == "__main__":
    verify_jwt_config()





