import requests
import json
import random
import string

BASE_URL = "http://localhost:8000/api/accounts"

def generate_random_string(length=8):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def run_tests():
    username = f"user_{generate_random_string()}"
    email = f"{username}@example.com"
    password = "password123"
    name = "Test User"

    print(f"Testing with User: {username}, Email: {email}")

    # 1. Register
    register_url = f"{BASE_URL}/register/"
    register_data = {
        "name": name,
        "username": username,
        "email": email,
        "password": password
    }
    
    print(f"1. Testing Registration ({register_url})...")
    try:
        response = requests.post(register_url, json=register_data)
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        if response.status_code == 201:
            print("   [PASS] Registration Successful")
        else:
            print("   [FAIL] Registration Failed")
            return
    except Exception as e:
        print(f"   [FAIL] Request Exception: {e}")
        return

    # 2. Login
    login_url = f"{BASE_URL}/login/"
    login_data = {
        "username": username,
        "password": password
    }

    print(f"2. Testing Login ({login_url})...")
    try:
        response = requests.post(login_url, json=login_data)
        print(f"   Status Code: {response.status_code}")
        print(f"   Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if 'access' in data and 'refresh' in data:
                 print("   [PASS] Login Successful")
            else:
                 print("   [FAIL] Tokens missing in response")
        else:
            print("   [FAIL] Login Failed")

    except Exception as e:
        print(f"   [FAIL] Request Exception: {e}")

if __name__ == "__main__":
    run_tests()
