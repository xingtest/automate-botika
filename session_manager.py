import json
import os
import uuid
import logging
from typing import Optional, Tuple, List, Dict, Any

def create_session_folder() -> Tuple[str, str]:
    """Create a new session folder with unique ID."""
    session_id = str(uuid.uuid4())
    folder_path = os.path.join('sessions', session_id)
    os.makedirs(folder_path, exist_ok=True)
    return folder_path, session_id

def save_session_cookies(folder_path: str, cookies: List[Dict[str, Any]]) -> None:
    """Save cookies to session folder."""
    try:
        json_path = os.path.join(folder_path, 'cookies.json')
        with open(json_path, 'w') as f:
            json.dump(cookies, f, indent=2)
        logging.info(f"Session cookies saved to {json_path}")
    except Exception as e:
        logging.error(f"Failed to save session cookies: {e}")
        raise

def load_session_cookies(folder_path: str) -> Optional[List[Dict[str, Any]]]:
    """Load cookies from session folder."""
    try:
        # First try sessionfb.json if we're in the session folder
        sessionfb_path = os.path.join(folder_path, 'sessionfb.json')
        if os.path.exists(sessionfb_path):
            with open(sessionfb_path, 'r') as f:
                cookies = json.load(f)
                logging.info(f"Session cookies loaded from {sessionfb_path}")
                return cookies
        
        # Fallback to cookies.json
        json_path = os.path.join(folder_path, 'cookies.json')
        if os.path.exists(json_path):
            with open(json_path, 'r') as f:
                cookies = json.load(f)
                logging.info(f"Session cookies loaded from {json_path}")
                return cookies
    except Exception as e:
        logging.error(f"Failed to load session cookies: {e}")
    return None

def find_available_sessions() -> List[Tuple[str, str]]:
    """Find all available session folders with valid cookies."""
    available_sessions = []
    sessions_dir = 'session'  # Changed from 'sessions' to 'session'
    
    if not os.path.exists(sessions_dir):
        return available_sessions
    
    # Check for sessionfb.json file directly
    sessionfb_path = os.path.join(sessions_dir, 'sessionfb.json')
    if os.path.exists(sessionfb_path):
        try:
            # Validate cookies file
            with open(sessionfb_path, 'r') as f:
                cookies = json.load(f)
                if cookies and isinstance(cookies, list) and len(cookies) > 0:
                    available_sessions.append(('sessionfb', sessions_dir))
                    logging.info(f"Found valid Facebook session: sessionfb.json")
        except (json.JSONDecodeError, IOError):
            logging.warning(f"Invalid Facebook session found: sessionfb.json")
    
    # Also check for traditional session folders
    for session_id in os.listdir(sessions_dir):
        session_path = os.path.join(sessions_dir, session_id)
        cookies_path = os.path.join(session_path, 'cookies.json')
        
        if os.path.isdir(session_path) and os.path.exists(cookies_path):
            try:
                # Validate cookies file
                with open(cookies_path, 'r') as f:
                    cookies = json.load(f)
                    if cookies and isinstance(cookies, list) and len(cookies) > 0:
                        available_sessions.append((session_id, session_path))
                        logging.info(f"Found valid session: {session_id}")
            except (json.JSONDecodeError, IOError):
                logging.warning(f"Invalid session found: {session_id}")
                continue
    
    return available_sessions

def get_latest_session() -> Optional[Tuple[str, str]]:
    """Get the most recently created valid session."""
    sessions = find_available_sessions()
    if not sessions:
        return None
    
    # Sort by creation time (newest first)
    sessions_with_time = []
    for session_id, session_path in sessions:
        try:
            stat = os.stat(session_path)
            sessions_with_time.append((session_id, session_path, stat.st_ctime))
        except OSError:
            continue
    
    if sessions_with_time:
        sessions_with_time.sort(key=lambda x: x[2], reverse=True)
        latest = sessions_with_time[0]
        logging.info(f"Selected latest session: {latest[0]}")
        return (latest[0], latest[1])
    
    return None

def validate_session_cookies(cookie_file_path: str) -> bool:
    """
    Validate session cookies by checking file existence and basic structure.
    
    Args:
        cookie_file_path: Path to the cookie file
        
    Returns:
        True if cookies are valid, False otherwise
    """
    try:
        # If cookie_file_path is a directory, check for sessionfb.json first
        if os.path.isdir(cookie_file_path):
            sessionfb_path = os.path.join(cookie_file_path, 'sessionfb.json')
            if os.path.exists(sessionfb_path):
                cookie_file_path = sessionfb_path
            else:
                cookie_file_path = os.path.join(cookie_file_path, 'cookies.json')
        
        if not os.path.exists(cookie_file_path):
            logging.warning(f"Cookie file does not exist: {cookie_file_path}")
            return False
        
        # Load cookies from file
        with open(cookie_file_path, 'r') as f:
            cookies = json.load(f)
            
        if not cookies or not isinstance(cookies, list):
            logging.warning(f"Invalid cookie structure in: {cookie_file_path}")
            return False
        
        # Check for essential Facebook cookies
        essential_cookies = ['c_user', 'xs']  # Reduced to only the most critical cookies
        cookie_names = [cookie.get('name', '') for cookie in cookies if isinstance(cookie, dict)]
        
        missing_cookies = [name for name in essential_cookies if name not in cookie_names]
        if missing_cookies:
            logging.warning(f"Missing essential cookies: {missing_cookies}")
            return False
        
        logging.info(f"Session cookies validated successfully: {cookie_file_path}")
        return True
        
    except Exception as e:
        logging.error(f"Failed to validate session cookies: {e}")
        return False