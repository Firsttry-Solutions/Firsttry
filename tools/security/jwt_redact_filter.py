#!/usr/bin/env python3
"""
JWT Redaction Filter for git-filter-repo
Redacts JWT tokens and Bearer tokens from all blob contents.
"""
import re
import sys

def redact_jwt_patterns(content):
    """
    Redact JWT-like patterns from content.
    
    Patterns redacted:
    1. Exact JWT header: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
    2. Bearer JWT: Bearer <token>
    3. Standalone JWT-like: <base64>.<base64>.<base64> (20+ chars each segment)
    """
    if isinstance(content, bytes):
        text = content.decode('utf-8', errors='ignore')
        was_bytes = True
    else:
        text = content
        was_bytes = False
    
    # Pattern 1: Exact JWT header substring
    text = text.replace('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'REDACTED_JWT_HEADER')
    
    # Pattern 2: Bearer JWT tokens (Bearer <a>.<b>.<c>)
    # Match: Bearer followed by base64url chars, dots, minimum 20 chars per segment
    bearer_pattern = r'\bBearer\s+[A-Za-z0-9\-_=]{20,}\.[A-Za-z0-9\-_=]{20,}\.[A-Za-z0-9\-_=]{20,}\b'
    text = re.sub(bearer_pattern, 'Bearer REDACTED_JWT', text)
    
    # Pattern 3: Standalone JWT-like tokens (not after "Bearer")
    # Match: <a>.<b>.<c> where each segment is 20+ base64url chars
    # Use negative lookbehind to avoid matching if preceded by "Bearer "
    standalone_jwt_pattern = r'(?<!Bearer\s)\b[A-Za-z0-9\-_=]{20,}\.[A-Za-z0-9\-_=]{20,}\.[A-Za-z0-9\-_=]{20,}\b'
    text = re.sub(standalone_jwt_pattern, 'REDACTED_JWT', text)
    
    if was_bytes:
        return text.encode('utf-8')
    return text

if __name__ == '__main__':
    # When used as git-filter-repo blob callback, read from stdin
    content = sys.stdin.buffer.read()
    redacted = redact_jwt_patterns(content)
    sys.stdout.buffer.write(redacted)
