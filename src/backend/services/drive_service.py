import os
import os.path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseUpload
from config import GOOGLE_CLIENT_SECRET_PATH
import logging
import io
import json

logger = logging.getLogger(__name__)

SCOPES = ['https://www.googleapis.com/auth/drive.file']

class DriveService:
    def __init__(self):
        self.creds = None
        self.service = None
        if not GOOGLE_CLIENT_SECRET_PATH or not os.path.exists(GOOGLE_CLIENT_SECRET_PATH):
             logger.warning(f"GOOGLE_CLIENT_SECRET_PATH invalid ({GOOGLE_CLIENT_SECRET_PATH}). Drive disabled.")
             return

        self.authenticate()

    def authenticate(self):
        """Deprecated alias for _load_credentials to maintain compatibility if used elsewhere."""
        self._load_credentials()

    def _load_credentials(self):
        """Attempts to load credentials silently from storage."""
        # The file token.json stores the user's access and refresh tokens
        if os.path.exists('token.json'):
            try:
                self.creds = Credentials.from_authorized_user_file('token.json', SCOPES)
            except Exception as e:
                logger.error(f"Error loading token.json: {e}")

        # Refresh if expired
        if self.creds and self.creds.expired and self.creds.refresh_token:
            try:
                self.creds.refresh(Request())
            except Exception as e:
                logger.error(f"Error refreshing token: {e}")
                self.creds = None
        
        # If valid credentials exist, build service
        if self.creds and self.creds.valid:
            try:
                self.service = build('drive', 'v3', credentials=self.creds)
                logger.info("Google Drive Service Authenticated (Cached).")
            except Exception as e:
                logger.error(f"Failed to build Drive service: {e}")
                self.service = None
        else:
            logger.info("Google Drive not authenticated. User interaction required.")
            self.service = None

    def authorize(self):
        """
        Interactive authentication flow. 
        Opens a browser window for the user to log in.
        Returns True if successful, False otherwise.
        """
        if self.service:
            return True

        try:
            logger.info("Starting Google Drive interactive auth flow...")
            
            # Load client config to check type
            with open(GOOGLE_CLIENT_SECRET_PATH, 'r') as f:
                client_config = json.load(f)
            
            # Check if it's a web client or installed app
            if 'web' in client_config:
                logger.info("Detected 'web' client type. Using specialized flow...")
                # For 'web' client secrets, we must strictly match the redirect URI.
                # The User's Console shows http://localhost:8080 (no slash).
                # We will force the flow to use that, ignoring the JSON content if it differs.
                redirect_uri = 'http://localhost:8080'
                
                logger.info(f"Using redirect_uri: {redirect_uri}")
                flow = InstalledAppFlow.from_client_secrets_file(
                    GOOGLE_CLIENT_SECRET_PATH, 
                    SCOPES,
                    redirect_uri=redirect_uri
                )
            else:
                logger.info("Detected 'installed' client type.")
                flow = InstalledAppFlow.from_client_secrets_file(
                    GOOGLE_CLIENT_SECRET_PATH, SCOPES)
            
            # Use a fixed port to avoid random port issues.
            # User must whitelist http://localhost:8080/ in Google Cloud Console.
            logger.info("Launching local server on port 8080...")
            self.creds = flow.run_local_server(port=8080, prompt='consent', authorization_prompt_message='Please visit this URL: {url}')
            
            logger.info("Authentication successful. Saving tokens...")
            # Save the credentials for the next run
            with open('token.json', 'w') as token:
                token.write(self.creds.to_json())
                
            self.service = build('drive', 'v3', credentials=self.creds)
            logger.info("Google Drive Service Authenticated (Interactive).")
            return True
        except Exception as e:
             logger.error(f"Failed to authenticate with Drive: {e}", exc_info=True)
             raise e

    def create_folder(self, name: str, parent_id: str = None, app_properties: dict = None) -> str:
        if not self.service: return None
        
        file_metadata = {
            'name': name,
            'mimeType': 'application/vnd.google-apps.folder'
        }
        if parent_id:
            file_metadata['parents'] = [parent_id]
        
        # SOTA: Attach Metadata on Creation
        if app_properties:
            file_metadata['appProperties'] = app_properties
            
        try:
            file = self.service.files().create(body=file_metadata, fields='id').execute()
            safe_name = name.encode('ascii', 'replace').decode('ascii')
            logger.info(f"Drive Folder Created: {safe_name} (ID: {file.get('id')}) [Props: {app_properties}]")
            return file.get('id')
        except Exception as e:
            logger.error(f"Error creating folder {name}: {e}")
            return None

    def find_folder_by_property(self, key: str, value: str, parent_id: str = None) -> str:
        """SOTA: Robust lookup via appProperties (Idempotency)."""
        if not self.service: return None
        
        # Query: appProperties has key=value AND not trashed
        query = f"appProperties has {{ key='{key}' and value='{value}' }} and trashed=false and mimeType='application/vnd.google-apps.folder'"
        
        if parent_id:
            query += f" and '{parent_id}' in parents" # Strict hierarchy check
            
        try:
            results = self.service.files().list(
                q=query, 
                spaces='drive', 
                fields='files(id, name, appProperties)',
                pageSize=1
            ).execute()
            
            files = results.get('files', [])
            if files:
                logger.debug(f"Found folder by property {key}={value}: {files[0].get('id')}")
                return files[0]['id']
            return None
        except Exception as e:
            logger.error(f"Error finding folder by property {key}={value}: {e}")
            return None

    def ensure_folder(self, name: str, parent_id: str = None) -> str:
        """Legacy wrapper for simple name-based ensure."""
        return self.ensure_folder_sota(name, parent_id)

    def ensure_folder_sota(self, name: str, parent_id: str = None, entity_id: str = None, entity_type: str = None) -> str:
        """
        SOTA: Ensures folder exists using Metadata first, then Name.
        Args:
            entity_id: DB ID of the entity (Company/Project/Session)
            entity_type: 'company', 'project', 'session', 'profile'
        """
        if not self.service: return None
        
        # 1. Metadata Lookup (Idempotency)
        if entity_id:
            existing_id = self.find_folder_by_property('db_id', entity_id, parent_id)
            if existing_id: return existing_id
        
        # 2. Name Lookup (Legacy/Fallback)
        query = f"mimeType='application/vnd.google-apps.folder' and name='{name}' and trashed=false"
        if parent_id:
            query += f" and '{parent_id}' in parents"
        
        try:
            results = self.service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
            files = results.get('files', [])
            
            if files:
                # Found by name, but maybe missing metadata? We could update it, but let's just return.
                return files[0]['id']
            else:
                # 3. Create New
                props = {}
                if entity_id: props['db_id'] = entity_id
                if entity_type: props['type'] = entity_type
                
                return self.create_folder(name, parent_id, app_properties=props)
                
        except Exception as e:
            logger.error(f"Error ensuring folder sota {name}: {e}")
            return None

    def upload_file(self, file_path: str, mime_type: str = None, parent_id: str = None) -> str:
        if not self.service: return None
        if not os.path.exists(file_path): 
            logger.error(f"File not found: {file_path}")
            return None
            
        name = os.path.basename(file_path)
        file_metadata = {'name': name}
        if parent_id:
            file_metadata['parents'] = [parent_id]
            
        try:
            media = MediaFileUpload(file_path, mimetype=mime_type)
            file = self.service.files().create(body=file_metadata, media_body=media, fields='id').execute()
            return file.get('id')
        except Exception as e:
            logger.error(f"Error uploading file {name}: {e}")
            return None

    def upload_content(self, content: str, filename: str, mime_type: str, parent_id: str = None) -> str:
        """
        Uploads string content directly to Drive as a file.
        """
        if not self.service: return None
        return self.upload_bytes(content.encode('utf-8'), filename, mime_type, parent_id)

    def upload_bytes(self, content: bytes, filename: str, mime_type: str, parent_id: str = None) -> str:
        """
        Uploads raw bytes directly to Drive as a file.
        """
        if not self.service: return None
        
        file_metadata = {'name': filename}
        if parent_id:
            file_metadata['parents'] = [parent_id]
            
        try:
            # Create an in-memory stream
            fh = io.BytesIO(content)
            media = MediaIoBaseUpload(fh, mimetype=mime_type, resumable=True)
            
            file = self.service.files().create(body=file_metadata, media_body=media, fields='id').execute()
            return file.get('id')
        except Exception as e:
            logger.error(f"Error uploading bytes for {filename}: {e}")
            return None

    def list_files(self, folder_id: str) -> list:
        """List files in a specific folder."""
        if not self.service: return []
        
        query = f"'{folder_id}' in parents and trashed=false"
        try:
            results = self.service.files().list(
                q=query, 
                fields="nextPageToken, files(id, name, mimeType, webViewLink, iconLink, createdTime, thumbnailLink)",
                pageSize=100
            ).execute()
            return results.get('files', [])
        except Exception as e:
            logger.error(f"Error listing files in {folder_id}: {e}")
            return None

    def get_file_bytes(self, file_id: str) -> bytes:
        if not self.service: return None
        try:
             return self.service.files().get_media(fileId=file_id).execute()
        except Exception as e:
             logger.error(f"Error downloading file {file_id}: {e}")
             return None

    def delete_file(self, file_id: str):
        """Permanent delete of a file."""
        if not self.service: return None
        try:
            self.service.files().delete(fileId=file_id).execute()
            return True
        except Exception as e:
            logger.error(f"Error deleting file {file_id}: {e}")
            return False

    def update_file_metadata(self, file_id: str, body: dict) -> dict:
        """Updates file metadata (e.g. appProperties)."""
        if not self.service: return None
        try:
             updated_file = self.service.files().update(
                 fileId=file_id, 
                 body=body,
                 fields='id, name, appProperties'
             ).execute()
             logger.info(f"Updated metadata for file {file_id}: {body}")
             return updated_file
        except Exception as e:
             logger.error(f"Error updating metadata for {file_id}: {e}")
             return None

# Singleton
_drive_service = None

def get_drive_service():
    global _drive_service
    if _drive_service is None:
        _drive_service = DriveService()
    return _drive_service
