# Protocol Script Uploader

A web interface for uploading and executing protocol scripts (.py and .json files) on a target server in LAN environments.

## Features

- Drag-and-drop file upload interface
- Support for Python (.py) and JSON (.json) files
- Real-time upload progress
- Protocol execution control (Start/Stop)
- API response display
- Local deployment ready (no internet required)

## Requirements

- Python 3.7+
- FastAPI
- aiohttp
- uvicorn

## Quick Start

1. Install dependencies:

```bash
pip install fastapi aiohttp uvicorn
```

2. Run the server:

```bash
uvicorn main:app --reload
```

