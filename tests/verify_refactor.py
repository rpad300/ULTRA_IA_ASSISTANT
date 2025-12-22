import sys
import os
import asyncio
from typing import Optional

# Add src to path
sys.path.append(os.path.join(os.getcwd(), "src", "backend"))

from db.models import CompanyCreate, ProjectCreate, ContactCreate
from services.company_service import get_company_service
from services.project_service import get_project_service
from services.contact_service import get_contact_service
from services.document_service import get_document_service

def test_pydantic_validation():
    print("Testing Pydantic Sanitization...")
    
    # Test Name Sanitization
    dirty_name = "  My Company   "
    c = CompanyCreate(name=dirty_name)
    assert c.name == "My Company", f"Expected 'My Company', got '{c.name}'"
    print(f"✅ Company Name Sanitized: '{dirty_name}' -> '{c.name}'")
    
    # Test URL Validation
    url_no_proto = "google.com"
    c = CompanyCreate(name="Google", website=url_no_proto)
    assert c.website == "https://google.com", f"Expected 'https://google.com', got '{c.website}'"
    print(f"✅ Website Normalized: '{url_no_proto}' -> '{c.website}'")
    
    # Test Description Sanitization
    desc = "  A description   "
    p = ProjectCreate(name="P1", company_id="123", description=desc)
    assert p.description == "A description", f"Expected 'A description', got '{p.description}'"
    print(f"✅ Project Description Sanitized: '{desc}' -> '{p.description}'")

def test_service_imports():
    print("\nTesting Service Imports...")
    try:
        cs = get_company_service()
        print(f"✅ CompanyService: {cs}")
        
        ps = get_project_service()
        print(f"✅ ProjectService: {ps}")
        
        cts = get_contact_service()
        print(f"✅ ContactService: {cts}")
        
        ds = get_document_service()
        print(f"✅ DocumentService: {ds}")
        
    except Exception as e:
        print(f"❌ Service Import Failed: {e}")
        raise e

if __name__ == "__main__":
    try:
        test_pydantic_validation()
        test_service_imports()
        print("\n🎉 Refactor Verification Passed!")
    except Exception as e:
        print(f"\n❌ Verification Failed: {e}")
        sys.exit(1)
