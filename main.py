from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import Dict, Any
import aiohttp

# Constants
ALLOWED_FILE_EXTENSION = ".py"
PYTHON_MIME_TYPE = "application/x-python"

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

async def validate_python_file(file: UploadFile) -> None:
    """Validate if the uploaded file is a Python file."""
    if not file.filename.lower().endswith(ALLOWED_FILE_EXTENSION):
        raise HTTPException(
            status_code=400, 
            detail=f"File {file.filename} is not a Python file"
        )

async def create_protocol(
    session: aiohttp.ClientSession, 
    url: str, 
    content: bytes, 
    filename: str
) -> Dict[str, Any]:
    """Create a protocol by sending the file to the target service."""
    data = aiohttp.FormData()
    data.add_field('files', content, filename=filename, content_type=PYTHON_MIME_TYPE)
    
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
        files: The uploaded Python protocol file
        target_url: The target service URL
    
    Returns:
        Dict containing the protocol ID and run information
    """
    try:
        await validate_python_file(files)
        content = await files.read()
        
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

@app.post("/protocols/stop/{run_id}")
async def stop_run(
    run_id: str,
    target_url: str = Form(...)
) -> Dict[str, Any]:
    """Stop a running protocol."""
    try:
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