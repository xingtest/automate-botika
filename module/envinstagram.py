import os
import time
from pathlib import Path
from instagrapi import Client
from instagrapi.exceptions import ClientError, LoginRequired

# Shared Instagram client instance
cl = None

def initialize_instagram_api():
    """
    Initializes the Instagram client, logs in using a session file,
    and then saves the session back to the file to keep it fresh.
    """
    global cl
    if cl:
        return  # Already initialized

    cl = Client()
    session_file = Path("session/session.json")
    session_file.parent.mkdir(exist_ok=True)

    if not session_file.exists():
        raise FileNotFoundError(f"Session file not found at '{session_file}'. Please generate it first.")

    try:
        print(f"Attempting to log in using session file: {session_file}")
        cl.load_settings(session_file)
        cl.login_by_sessionid(cl.sessionid)
        cl.get_timeline_feed()
        print(f"Successfully logged in as {cl.username}.")
        cl.dump_settings(session_file)
        print(f"Session state for {cl.username} has been refreshed and saved.")
    except Exception as e:
        print(f"An unexpected error occurred during session login: {e}")
        raise

def send_message(username: str, text: str):
    """
    Sends a direct message to a user.
    """
    if not cl:
        raise Exception("Instagram client not initialized.")
    try:
        user_id = cl.user_id_from_username(username)
        print(f"Sending message to '{username}' (User ID: {user_id})...")
        cl.direct_send(text, user_ids=[user_id])
        print("Message sent successfully.")
        # Return the current time to be used as a marker for the new message
        return time.time()
    except Exception as e:
        print(f"Failed to send message to {username}: {e}")
        return None

def get_latest_message(username: str, after_timestamp: float) -> str:
    """
    Gets the latest message from a user in a DM thread that arrived AFTER a specific timestamp.
    This method is more robust by iterating through all threads to find the correct one.
    """
    if not cl:
        raise Exception("Instagram client not initialized.")

    try:
        target_user_id = cl.user_id_from_username(username)
        my_user_id = cl.user_id
        
        print(f"Polling for a new message from '{username}' for up to 60 seconds...")
        timeout = 60  # seconds
        start_time = time.time()

        while time.time() - start_time < timeout:
            # Fetch the first few threads from the inbox
            threads = cl.direct_threads(amount=20)
            
            target_thread = None
            for thread in threads:
                # Find the thread that involves the target user
                user_pks = [user.pk for user in thread.users]
                if target_user_id in user_pks:
                    target_thread = thread
                    break
            
            if target_thread:
                # Fetch the latest message from the identified thread
                latest_message = target_thread.messages[0] if target_thread.messages else None
                
                if latest_message:
                    # Check if the message is from the target user and is new
                    message_timestamp = latest_message.timestamp.timestamp()
                    
                    if str(latest_message.user_id) == str(target_user_id) and message_timestamp > after_timestamp:
                        print(f"Success! Received response from {username}: {latest_message.text}")
                        return latest_message.text

            print(f"No new message from {username} yet, waiting 5 seconds...")
            time.sleep(5)

        print(f"Timeout: No new message received from {username} after {timeout} seconds.")
        return ""

    except Exception as e:
        print(f"An error occurred while fetching the latest message from {username}: {e}")
        return ""