from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os
import aiohttp
import asyncio
from datetime import datetime

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)

@app.post("/protocols")
async def upload_protocols(
    files: List[UploadFile] = File(...),
    target_url: str = Form(...)
):
    try:
        results = []
        async with aiohttp.ClientSession() as session:
            for file in files:
                if not file.filename.lower().endswith('.py'):
                    raise HTTPException(status_code=400, detail=f"File {file.filename} is not a Python file")
                
                content = await file.read()
                data = aiohttp.FormData()
                data.add_field('files', content, filename=file.filename, content_type='application/x-python')

                forward_url = f"{target_url}/protocols"
                async with session.post(forward_url, data=data) as response:
                    results.append({
                        "file": file.filename,
                        "status": response.status,
                        "response": await response.json()
                    })

        return {"message": "Files forwarded successfully", "results": results}

    except aiohttp.ClientError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        for file in files:
            await file.close()

@app.get("/")
async def read_root():
    return {"status": "running", "service": "Protocol Upload Server"}