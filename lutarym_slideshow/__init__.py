"""Lutarym Slideshow Integration"""
import asyncio
import logging
from datetime import datetime, time
from typing import Optional, List
import re

from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType
from homeassistant.components.http import HomeAssistantView
from homeassistant.const import Platform
from aiohttp import web

try:
    from smbclient import listdir, scandir, rename, remove, mkdir
    from smbclient.path import isdir, isfile
    SMBCLIENT_AVAILABLE = True
except ImportError:
    SMBCLIENT_AVAILABLE = False

_LOGGER = logging.getLogger(__name__)
DOMAIN = "lutarym_slideshow"

async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the integration."""
    if not SMBCLIENT_AVAILABLE:
        _LOGGER.error("smbclient not installed. Install via requirements.")
        return False

    hass.data[DOMAIN] = {
        "images": [],
        "cleanup_done": False
    }

    # Register HTTP endpoint
    hass.http.register_view(SlideshowAPIView)

    # Schedule daily cleanup at midnight
    async def cleanup_task(now=None):
        """Check and archive/delete expired images."""
        await perform_cleanup(hass)

    from homeassistant.helpers.event import async_track_time_change
    async_track_time_change(hass, cleanup_task, hour=0, minute=0, second=0)

    # Initial cleanup
    await perform_cleanup(hass)

    _LOGGER.info("Lutarym Slideshow integration loaded")
    return True


async def perform_cleanup(hass: HomeAssistant) -> None:
    """Check for expired images and archive/delete them."""
    _LOGGER.debug("Starting slideshow cleanup task")
    
    try:
        # This will be called from the card with SMB credentials
        # For now, just log that we're ready
        _LOGGER.debug("Slideshow cleanup ready (awaiting card initialization)")
    except Exception as e:
        _LOGGER.error(f"Cleanup error: {e}")


class SlideshowAPIView(HomeAssistantView):
    """HTTP API for slideshow card."""
    
    url = "/api/lutarym_slideshow"
    name = "lutarym_slideshow"
    requires_auth = False

    async def post(self, request: web.Request) -> web.Response:
        """Handle POST requests from card."""
        try:
            data = await request.json()
            action = data.get("action")

            if action == "list":
                images = await get_images(
                    data.get("smb_host"),
                    data.get("smb_share"),
                    data.get("smb_user"),
                    data.get("smb_password"),
                    data.get("image_path")
                )
                return web.json_response({"images": images, "error": None})

            elif action == "cleanup":
                result = await cleanup_expired(
                    data.get("smb_host"),
                    data.get("smb_share"),
                    data.get("smb_user"),
                    data.get("smb_password"),
                    data.get("image_path"),
                    data.get("archive_path"),
                    data.get("archive_mode", True)  # True = archive, False = delete
                )
                return web.json_response(result)

            return web.json_response({"error": "Unknown action"})

        except Exception as e:
            _LOGGER.error(f"API error: {e}")
            return web.json_response({"error": str(e)}, status=500)


async def get_images(smb_host: str, smb_share: str, smb_user: str, 
                     smb_password: str, image_path: str) -> List[str]:
    """Get list of valid (non-expired) JPG images from SMB."""
    images = []
    
    try:
        smb_path = f"//{smb_host}/{smb_share}{image_path}"
        
        # Register SMB session
        from smbclient import register_session
        register_session(smb_host, username=smb_user, password=smb_password)
        
        entries = scandir(smb_path)
        today = datetime.now().date()
        
        for entry in entries:
            if entry.name.lower().endswith('.jpg'):
                # Extract date from filename (format: DD.MM.YYYY.jpg)
                match = re.search(r'(\d{2})\.(\d{2})\.(\d{4})', entry.name)
                if match:
                    day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
                    try:
                        expiry_date = datetime(year, month, day).date()
                        if expiry_date >= today:
                            images.append(entry.name)
                    except ValueError:
                        _LOGGER.warning(f"Invalid date in filename: {entry.name}")
                else:
                    _LOGGER.warning(f"No date found in filename: {entry.name}")
        
        return sorted(images)
    
    except Exception as e:
        _LOGGER.error(f"Error getting images: {e}")
        return []


async def cleanup_expired(smb_host: str, smb_share: str, smb_user: str,
                         smb_password: str, image_path: str, archive_path: str,
                         archive_mode: bool = True) -> dict:
    """Move or delete expired images."""
    result = {"moved": [], "deleted": [], "errors": []}
    
    try:
        from smbclient import register_session
        register_session(smb_host, username=smb_user, password=smb_password)
        
        smb_image_path = f"//{smb_host}/{smb_share}{image_path}"
        smb_archive_path = f"//{smb_host}/{smb_share}{archive_path}"
        
        # Ensure archive directory exists
        if archive_mode and not isdir(smb_archive_path):
            try:
                mkdir(smb_archive_path)
            except Exception as e:
                _LOGGER.warning(f"Could not create archive dir: {e}")
        
        entries = scandir(smb_image_path)
        today = datetime.now().date()
        
        for entry in entries:
            if entry.name.lower().endswith('.jpg'):
                match = re.search(r'(\d{2})\.(\d{2})\.(\d{4})', entry.name)
                if match:
                    day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
                    try:
                        expiry_date = datetime(year, month, day).date()
                        if expiry_date < today:
                            src = f"{smb_image_path}{entry.name}"
                            if archive_mode:
                                dst = f"{smb_archive_path}{entry.name}"
                                try:
                                    rename(src, dst)
                                    result["moved"].append(entry.name)
                                except Exception as e:
                                    result["errors"].append(f"Failed to move {entry.name}: {e}")
                            else:
                                try:
                                    remove(src)
                                    result["deleted"].append(entry.name)
                                except Exception as e:
                                    result["errors"].append(f"Failed to delete {entry.name}: {e}")
                    except ValueError:
                        pass
        
        return result
    
    except Exception as e:
        _LOGGER.error(f"Cleanup error: {e}")
        return {"error": str(e), "moved": [], "deleted": []}
