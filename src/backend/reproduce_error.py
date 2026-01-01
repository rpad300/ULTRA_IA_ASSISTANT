
import json
import urllib.request
import urllib.error

def test_create_contact():
    url = "http://localhost:8000/api/contacts"
    
    # Payload mimicking what frontend sends
    payload = {
        "name": "Pedro Dias",
        "email": "rdias.100.test2@gmail.com", # changed to avoid duplicate of previous run
        "role": "Product Manager",
        "phone": "+1234567890",
        "status": "active",
        "company_id": "" # SOTA: Testing the failure case
    }
    
    print(f"Sending POST to {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        req = urllib.request.Request(url, method="POST")
        req.add_header('Content-Type', 'application/json')
        data = json.dumps(payload).encode('utf-8')
        
        with urllib.request.urlopen(req, data=data) as response:
            print(f"\nStatus Code: {response.status}")
            print(f"Response: {response.read().decode()}")
            
    except urllib.error.HTTPError as e:
        print(f"\nHTTP Error: {e.code}")
        print(f"Reason: {e.reason}")
        print(f"Response Body: {e.read().decode()}")
        
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_create_contact()
