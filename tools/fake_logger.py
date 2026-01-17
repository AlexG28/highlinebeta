#!/usr/bin/env python3
"""
Fake Log Generator for Highline Monitoring System

Simulates a Twitter-like service sending heartbeats with various events:
- Text messages
- File uploads (small)
- File uploads (large - causes failures ~10% of the time)
"""

import requests
import random
import time
import argparse
from datetime import datetime

# Configuration
BACKEND_URL = "http://localhost:8080"
SERVICE_NAME = "trivial-service"
GITHUB_REPO = "https://github.com/AlexG28/trivialExample"

# Fake data
USERNAMES = [
    "elonmusk", "jack", "naval", "paulg", "sama", 
    "lexfridman", "balajis", "pmarca", "vikimorris", "jason"
]

SAMPLE_MESSAGES = [
    "Just shipped a new feature! 🚀",
    "Anyone else having issues with the API?",
    "Great day for building",
    "This is a test tweet",
    "Hello world!",
    "Working on something exciting...",
    "The future is here",
    "Bug fix incoming",
    "Performance improvements landed",
    "New release notes coming soon"
]

FILE_EXTENSIONS = [".jpg", ".png", ".mp4", ".gif", ".pdf", ".doc"]

def generate_username():
    return random.choice(USERNAMES)

def generate_text_message():
    """Generate a normal text message event"""
    message = random.choice(SAMPLE_MESSAGES)
    return {
        "status": "healthy",
        "log_data": {
            "event_type": "text_message",
            "details": {
                "user": generate_username(),
                "message_length": len(message),
                "message_preview": message[:50]
            }
        }
    }

def generate_small_file_upload():
    """Generate a small file upload event (success)"""
    filesize = random.uniform(0.1, 10.0)  # 0.1 MB to 10 MB
    ext = random.choice(FILE_EXTENSIONS)
    filename = f"upload_{random.randint(1000, 9999)}{ext}"
    
    return {
        "status": "healthy",
        "log_data": {
            "event_type": "file_upload",
            "details": {
                "user": generate_username(),
                "filename": filename,
                "filesize_mb": round(filesize, 2),
                "file_type": ext[1:].upper()
            }
        }
    }

def generate_type_error_failure():
    """Generate a TypeError traceback failure"""
    traceback = """Traceback (most recent call last):
  File "main.py", line 9, in <module>
    print(divide(inpt))
          ~~~~~~^^^^^^
  File "main.py", line 2, in divide
    return 100 / number
           ~~~~^~~~~~~~
TypeError: unsupported operand type(s) for /: 'int' and 'str'"""
    
    return {
        "status": "error",
        "error_log": traceback,
        "log_data": {
            "event_type": "type_error",
            "details": {
                "user": generate_username(),
                "reason": "TypeError in main.py",
                "traceback": traceback
            }
        }
    }

def send_heartbeat(data):
    """Send a heartbeat to the backend"""
    payload = {
        "service_name": SERVICE_NAME,
        "github_repo": GITHUB_REPO,
        **data
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/heartbeat",
            json=payload,
            timeout=5
        )
        return response.status_code == 200
    except requests.RequestException as e:
        print(f"  ❌ Failed to send: {e}")
        return False

def generate_event(count):
    """Generate a random event, but force failure on the 11th message (after 10 successes)"""
    if count == 11:
        return generate_type_error_failure(), "FAILURE"
    
    roll = random.random()
    if roll < 0.10:  # 10% chance of small file upload
        return generate_small_file_upload(), "FILE"
    else:  # 90% chance of text message
        return generate_text_message(), "TEXT"

def main():
    parser = argparse.ArgumentParser(description="Fake log generator for Highline")
    parser.add_argument("--url", default="http://localhost:8080", help="Backend URL")
    parser.add_argument("--interval", type=float, default=2.0, help="Seconds between events")
    parser.add_argument("--count", type=int, default=0, help="Number of events (0 = infinite)")
    args = parser.parse_args()
    
    # global BACKEND_URL
    BACKEND_URL = args.url
    
    print(f"""
╔══════════════════════════════════════════════════════════╗
║      🐦 Highline Fake Log Generator - Trivial API        ║
╠══════════════════════════════════════════════════════════╣
║  Backend URL: {args.url:<42}                             ║
║  Interval: {args.interval}s                              ║
║  Service: {SERVICE_NAME:<45}                             ║
╚══════════════════════════════════════════════════════════╝
    """)
    
    count = 0
    try:
        while args.count == 0 or count < args.count:
            count += 1
            event_data, event_type = generate_event(count)
            
            timestamp = datetime.now().strftime("%H:%M:%S")
            
            # Format log output
            if event_type == "FAILURE":
                icon = "🔴"
                details = event_data["log_data"]["details"]
                desc = f"CRASH: {details['reason']}"
            elif event_type == "FILE":
                icon = "📁"
                details = event_data["log_data"]["details"]
                desc = f"@{details['user']} uploaded {details['filename']} ({details['filesize_mb']:.1f} MB)"
            else:
                icon = "💬"
                details = event_data["log_data"]["details"]
                desc = f"@{details['user']}: {details.get('message_preview', 'message')[:40]}"
            
            print(f"[{timestamp}] {icon} #{count:04d} {desc}")
            
            success = send_heartbeat(event_data)
            if not success:
                print(f"         └── ⚠️  Failed to send to backend")
            
            # Stop sending after an error (simulates service going down)
            if event_type == "FAILURE":
                print(f"\n💀 Service crashed after error! Stopping heartbeats...")
                print(f"   (The monitoring system should detect this and trigger remediation)")
                break
            
            time.sleep(args.interval)
            
    except KeyboardInterrupt:
        print(f"\n\n✅ Stopped after {count} events")

if __name__ == "__main__":
    main()
