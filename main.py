from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import Dict, Any
import aiohttp
from pathlib import Path

# Constants
ALLOWED_FILE_EXTENSIONS = [".py", ".json"]
MIME_TYPES = {
    ".py": "application/x-python",
    ".json": "application/json"
}

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS", "GET"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_root() -> FileResponse:
    """Serve the index.html file."""
    return FileResponse('index.html')

async def validate_file(file: UploadFile) -> None:
    """Validate if the uploaded file has an allowed extension."""
    file_ext = "".join(Path(file.filename).suffixes).lower()
    if not any(file_ext.endswith(ext) for ext in ALLOWED_FILE_EXTENSIONS):
        raise HTTPException(
            status_code=400, 
            detail=f"File {file.filename} must be a Python or JSON file"
        )

async def create_protocol(
    session: aiohttp.ClientSession, 
    url: str, 
    content: bytes, 
    filename: str
) -> Dict[str, Any]:
    """Create a protocol by sending the file to the target service."""
    data = aiohttp.FormData()
    file_ext = "".join(Path(filename).suffixes).lower()
    mime_type = MIME_TYPES.get(file_ext, "application/octet-stream")
    
    data.add_field('files', content, filename=filename, content_type=mime_type)
    
    async with session.post(f"{url}/protocols", data=data) as response:
        response.raise_for_status()
        result = await response.json()
        
        if result["success"] == False:
            raise Exception(result["message"])
        
        return result["data"]["id"]

async def create_run(
    session: aiohttp.ClientSession,
    target_url: str,
    protocol_id: str
) -> Dict[str, Any]:
    """Create a run for the given protocol ID."""
    async with session.post(
        f"{target_url}/runs",
        json={"data": {"protocolId": protocol_id}}
    ) as response:
        response.raise_for_status()
        result = await response.json()
        
        if result["success"] == False:
            raise Exception(result["message"])
        
        return result["data"]["id"]

async def start_run(
    session: aiohttp.ClientSession,
    target_url: str,
    run_id: str
) -> Dict[str, Any]:
    """Start the run."""
    async with session.post(
        f"{target_url}/runs/{run_id}/actions",
        json={"data": {"actionType": "play"}}
    ) as response:
        response.raise_for_status()
        result = await response.json()
        
        if result["success"] == False:
            raise Exception(result["message"])
        
        return result["message"]

@app.post("/protocols")
async def upload_protocol(
    files: UploadFile = File(...),
    target_url: str = Form(...)
) -> Dict[str, Any]:
    """
    Handle protocol upload and run creation.
    
    Args:
        files: The uploaded Python or JSON protocol file
        target_url: The target service URL
    
    Returns:
        Dict containing the protocol ID and run information
    """
    try:
        await validate_file(files)
        content = await files.read()
        
        # Add http:// prefix if not present
        if not target_url.startswith('http://'):
            target_url = f'http://{target_url}'
        
        async with aiohttp.ClientSession() as session:
            # Create protocol
            protocol_id = await create_protocol(session, target_url, content, files.filename)
            
            # Create run using the same target_url
            run_id = await create_run(session, target_url, protocol_id)

            # Start run
            action_result = await start_run(session, target_url, run_id)
            
            return {
                "message": "File forwarded successfully",
                "protocol_id": protocol_id,
                "run_id": run_id,
                "action_result": action_result
            }

    except aiohttp.ClientResponseError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    except aiohttp.ClientError as e:
        raise HTTPException(status_code=502, detail=f"{str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"{str(e)}")
    finally:
        await files.close()

@app.post("/protocols/stop")
async def stop_run(
    target_url: str = Form(...),
    run_id: str = Form(...)
) -> Dict[str, Any]:
    """Stop a running protocol."""
    try:
        # Add http:// prefix if not present
        if not target_url.startswith('http://'):
            target_url = f'http://{target_url}'
            
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{target_url}/runs/{run_id}/actions",
                json={"data": {"actionType": "stop"}}
            ) as response:
                response.raise_for_status()
                result = await response.json()
                return {"message": "Run stopped successfully", "data": result}

    except aiohttp.ClientResponseError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    except aiohttp.ClientError as e:
        raise HTTPException(status_code=502, detail=f"Network error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.post("/move-pipette")
async def move_pipette(
    target_url: str = Form(...)
) -> Dict[str, Any]:
    """Move pipette to slot 1."""
    errors = []
    try:
        if not target_url.startswith('http://'):
            target_url = f'http://{target_url}'
            
        async with aiohttp.ClientSession() as session:
            # Define movement steps
            steps = [
                ("pipette/1/move-z/0", "Move pipette 1 to z=0"),
                ("pipette/8/move-z/0", "Move pipette 8 to z=0"), 
                ("pipette/8/move-g/20", "Move gripper to g=20"),
                ("pipette/8/move-z/0", "Move gripper to z=0"),
                ("pipette/8/move-g/0", "Move gripper to g=0"),
                ("pipette/8/move-xyz/0/0/0", "Move pipette 8 to final position")
            ]

            result = None
            for endpoint, description in steps:
                try:
                    async with session.post(
                        f"{target_url}/{endpoint}",
                        json={}
                    ) as response:
                        response.raise_for_status()
                        result = await response.json()
                except Exception as e:
                    errors.append(f"{description} failed: {str(e)}")

            response_message = "Pipette movements completed"
            if errors:
                response_message += f" with {len(errors)} errors"
            return {
                "message": response_message,
                "data": result,
                "errors": errors
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.post("/light/{state}")
async def control_light(
    state: str,
    target_url: str = Form(...)
) -> Dict[str, Any]:
    """Control the lighting system."""
    if state not in ['on', 'off']:
        raise HTTPException(status_code=400, detail="Invalid state. Use 'on' or 'off'")
    
    try:
        if not target_url.startswith('http://'):
            target_url = f'http://{target_url}'
            
        async with aiohttp.ClientSession() as session:
            payload = {
                "type": "lighting",
                "on": state == 'on'
            }
            
            async with session.post(
                f"{target_url}/system/lights",
                json=payload,
                headers={'Content-Type': 'application/json'}
            ) as response:
                response.raise_for_status()
                result = await response.json()
                return {
                    "message": f"Light turned {state} successfully",
                    "data": result
                }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.post("/uv/{state}")
async def control_uv(
    state: str,
    target_url: str = Form(...)
) -> Dict[str, Any]:
    """Control the UV light system."""
    if state not in ['on', 'off']:
        raise HTTPException(status_code=400, detail="Invalid state. Use 'on' or 'off'")
    
    try:
        if not target_url.startswith('http://'):
            target_url = f'http://{target_url}'
            
        async with aiohttp.ClientSession() as session:
            payload = {
                "type": "ultraviolet",
                "on": state == 'on'
            }
            
            async with session.post(
                f"{target_url}/system/lights",
                json=payload,
                headers={'Content-Type': 'application/json'}
            ) as response:
                response.raise_for_status()
                result = await response.json()
                return {
                    "message": f"UV light turned {state} successfully",
                    "data": result
                }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")
    
@app.post("/fan/{state}")
async def control_fan(
    state: str,
    target_url: str = Form(...)
) -> Dict[str, Any]:
    """Control the hepa filter."""
    if state not in ['on', 'off']:
        raise HTTPException(status_code=400, detail="Invalid state. Use 'on' or 'off'")
    
    try:
        if not target_url.startswith('http://'):
            target_url = f'http://{target_url}'
            
        async with aiohttp.ClientSession() as session:
            payload = {
                "type": "ffu",
                "on": state == 'on'
            }
            
            async with session.post(
                f"{target_url}/system/lights",
                json=payload,
                headers={'Content-Type': 'application/json'}
            ) as response:
                response.raise_for_status()
                result = await response.json()
                return {
                    "message": f"Fan turned {state} successfully",
                    "data": result
                }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.post("/lights/status")
async def get_lights_status(
    target_url: str = Form(...)
) -> Dict[str, Any]:
    """Get the current status of both lights."""
    try:
        if not target_url.startswith('http://'):
            target_url = f'http://{target_url}'
            
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{target_url}/system/lights",
            ) as response:
                response.raise_for_status()
                result = await response.json()
                
                if not result.get("success", False):
                    raise HTTPException(status_code=400, detail=result.get("message", "Unknown error"))
                
                return {
                    "message": "Light status retrieved successfully",
                    "data": {
                        "lighting": result["data"]["lighting"],
                        "ultraviolet": result["data"]["ultraviolet"],
                        "ffu": result["data"]["ffu"]
                    }
                }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.post("/modules")
async def get_modules_status(
    target_url: str = Form(...)
) -> Dict[str, Any]:
    """Get the status of all modules."""
    try:
        if not target_url.startswith('http://'):
            target_url = f'http://{target_url}'
            
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{target_url}/modules",
            ) as response:
                response.raise_for_status()
                result = await response.json()
                return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.post("/modules/temperature/deactivate")
async def deactivate_temperature_module(
    target_url: str = Form(...)
) -> Dict[str, Any]:
    """Deactivate the temperature module."""
    try:
        if not target_url.startswith('http://'):
            target_url = f'http://{target_url}'
            
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{target_url}/modules/temperatureModule/deactivate",
                json={}
            ) as response:
                response.raise_for_status()
                result = await response.json()
                return {
                    "message": "Temperature module deactivated successfully",
                    "data": result
                }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.post("/modules/magnetic/disengage")
async def disengage_magnetic_module(
    target_url: str = Form(...)
) -> Dict[str, Any]:
    """Disengage the magnetic module."""
    try:
        if not target_url.startswith('http://'):
            target_url = f'http://{target_url}'
            
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{target_url}/modules/magneticModule/disengage",
                json={}
            ) as response:
                response.raise_for_status()
                result = await response.json()
                return {
                    "message": "Magnetic module disengaged successfully",
                    "data": result
                }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.post("/modules/heater-shaker/deactivate")
async def deactivate_heater(
    target_url: str = Form(...)
) -> Dict[str, Any]:
    """Deactivate both the heater and shaker."""
    try:
        if not target_url.startswith('http://'):
            target_url = f'http://{target_url}'
            
        async with aiohttp.ClientSession() as session:
            
            # Then deactivate shaker
            async with session.post(
                f"{target_url}/modules/heaterShaker/deactivateShaker",
                json={}
            ) as response:
                response.raise_for_status()
                shaker_result = await response.json()
                
            # First deactivate heater
            async with session.post(
                f"{target_url}/modules/heaterShaker/deactivateHeater",
                json={}
            ) as response:
                response.raise_for_status()
                heater_result = await response.json()

            return {
                "message": "Heater and shaker deactivated successfully",
                "data": {
                    "heater": heater_result,
                    "shaker": shaker_result
                }
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.post("/modules/thermocycler/deactivate")
async def deactivate_thermocycler(
    target_url: str = Form(...)
) -> Dict[str, Any]:
    """Deactivate the thermocycler."""
    try:
        if not target_url.startswith('http://'):
            target_url = f'http://{target_url}'
            
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{target_url}/modules/thermocycler/deactivate",
                json={}
            ) as response:
                response.raise_for_status()
                result = await response.json()
                return {
                    "message": "Thermocycler deactivated successfully",
                    "data": result
                }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.post("/modules/thermocycler/open-lid")
async def open_thermocycler_lid(
    target_url: str = Form(...)
) -> Dict[str, Any]:
    """Open the Thermocycler lid."""
    try:
        if not target_url.startswith('http://'):
            target_url = f'http://{target_url}'
            
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{target_url}/modules/thermocycler/openLid",
                json={}
            ) as response:
                response.raise_for_status()
                result = await response.json()
                return {
                    "message": "Thermocycler lid opened successfully",
                    "data": result
                }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.post("/modules/thermocycler/close-lid")
async def close_thermocycler_lid(
    target_url: str = Form(...)
) -> Dict[str, Any]:
    """Close the Thermocycler lid."""
    try:
        if not target_url.startswith('http://'):
            target_url = f'http://{target_url}'
            
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{target_url}/modules/thermocycler/closeLid",
                json={}
            ) as response:
                response.raise_for_status()
                result = await response.json()
                return {
                    "message": "Thermocycler lid closed successfully",
                    "data": result
                }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.post("/modules/heater-shaker/open-latch")
async def open_heater_shaker_latch(
    target_url: str = Form(...)
) -> Dict[str, Any]:
    """Open the HeaterShaker labware latch."""
    try:
        if not target_url.startswith('http://'):
            target_url = f'http://{target_url}'
            
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{target_url}/modules/heaterShaker/openLabwareLatch",
                json={}
            ) as response:
                response.raise_for_status()
                result = await response.json()
                return {
                    "message": "HeaterShaker latch opened successfully",
                    "data": result
                }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.post("/modules/heater-shaker/close-latch")
async def close_heater_shaker_latch(
    target_url: str = Form(...)
) -> Dict[str, Any]:
    """Close the HeaterShaker labware latch."""
    try:
        if not target_url.startswith('http://'):
            target_url = f'http://{target_url}'
            
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{target_url}/modules/heaterShaker/closeLabwareLatch",
                json={}
            ) as response:
                response.raise_for_status()
                result = await response.json()
                return {
                    "message": "HeaterShaker latch closed successfully",
                    "data": result
                }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.post("/init")
async def init_machine(
    target_url: str = Form(...)
) -> Dict[str, Any]:
    """Initialize the machine."""
    try:
        if not target_url.startswith('http://'):
            target_url = f'http://{target_url}'
            
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{target_url}/system/init",
                json={}
            ) as response:
                response.raise_for_status()
                result = await response.json()
                return {
                    "message": "Machine initialized successfully",
                    "data": result
                }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")