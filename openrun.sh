#!/bin/bash

# Configuration
PORT=8000
VENV_DIR="venv"
FRONTEND_DIR="frontend"

# Colors for terminal output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}           Welcome to OpenRun          ${NC}"
echo -e "${BLUE}=======================================${NC}"

# Cleanup function to kill all background processes on exit
cleanup() {
    echo -e "\n${RED}[+] Stopping OpenRun...${NC}"
    kill $(jobs -p) 2>/dev/null
    exit
}

# Trap Ctrl+C (SIGINT) and SIGTERM
trap cleanup SIGINT SIGTERM

function build_frontend() {
    echo -e "${GREEN}[+] Building frontend...${NC}"
    cd $FRONTEND_DIR || exit
    npm install
    npm run build
    cd ..
    echo -e "${GREEN}[+] Frontend build complete!${NC}"
}

function start_server() {
    echo -e "${GREEN}[+] Starting backend server on port ${PORT}...${NC}"
    if [ ! -d "$VENV_DIR" ]; then
        echo -e "${RED}[!] Virtual environment not found. Please set it up first.${NC}"
        exit 1
    fi
    
    # Activate virtual environment
    source $VENV_DIR/bin/activate
    
    # Run uvicorn in the background
    uvicorn main:app --host 0.0.0.0 --port $PORT &
    UVICORN_PID=$!
    
    # Give the server a second to start up
    sleep 2
    echo -e "${GREEN}[+] Server is running at http://localhost:${PORT}${NC}"
}

function start_ngrok() {
    if ! command -v ngrok &> /dev/null; then
        echo -e "${RED}[!] 'ngrok' command could not be found.${NC}"
        echo -e "Please install it from https://ngrok.com/download or authenticate using 'ngrok config add-authtoken <token>'."
        kill $UVICORN_PID
        exit 1
    fi
    echo -e "${GREEN}[+] Starting ngrok tunnel on port ${PORT}...${NC}"
    
    # Ngrok replaces the current process in the foreground
    ngrok http $PORT
}

function show_menu() {
    echo ""
    echo "Please select an option:"
    echo "  1) Start OpenRun Locally (http://localhost:$PORT)"
    echo "  2) Start OpenRun with Ngrok (Public URL)"
    echo "  3) Rebuild Frontend and Start Locally"
    echo "  4) Rebuild Frontend and Start with Ngrok"
    echo "  5) Exit"
    echo ""
    read -p "Enter choice [1-5]: " choice
    
    case $choice in
        1)
            start_server
            echo -e "${BLUE}Press Ctrl+C to stop the server.${NC}"
            wait $UVICORN_PID
            ;;
        2)
            start_server
            start_ngrok
            ;;
        3)
            build_frontend
            start_server
            echo -e "${BLUE}Press Ctrl+C to stop the server.${NC}"
            wait $UVICORN_PID
            ;;
        4)
            build_frontend
            start_server
            start_ngrok
            ;;
        5)
            echo "Exiting..."
            exit 0
            ;;
        *)
            echo -e "${RED}[!] Invalid option.${NC}"
            show_menu
            ;;
    esac
}

show_menu
