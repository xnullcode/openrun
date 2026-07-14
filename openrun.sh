#!/bin/bash

# Configuration
PORT=8000
VENV_DIR="venv"
FRONTEND_DIR="frontend"

# ─── Colors ──────────────────────────────────────────────────
BOLD='\033[1m'
DIM='\033[2m'
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
RESET='\033[0m'

# ─── Helpers ─────────────────────────────────────────────────
banner() {
    clear
    echo -e "${BOLD}${CYAN}"
    echo "  ┌─────────────────────────────────────────┐"
    echo "  │             OPENRUN CONSOLE             │"
    echo "  └─────────────────────────────────────────┘"
    echo -e "${RESET}"
}

info()    { echo -e "  ${CYAN}ℹ${RESET}  $1"; }
success() { echo -e "  ${GREEN}✓${RESET}  $1"; }
warn()    { echo -e "  ${YELLOW}⚠${RESET}  $1"; }
fail()    { echo -e "  ${RED}✗${RESET}  $1"; }
divider() { echo -e "  ${DIM}─────────────────────────────────────────${RESET}"; }

press_enter() {
    echo ""
    read -rp "  Press Enter to return to menu..." _
}

is_server_running() {
    pgrep -f "uvicorn main:app" &>/dev/null
}

is_ngrok_running() {
    pgrep -f "ngrok http $PORT" &>/dev/null
}

# ─── 1. Status ───────────────────────────────────────────────
show_status() {
    banner
    echo -e "  ${BOLD}System Status${RESET}"
    divider
    echo ""

    if is_server_running; then
        success "Uvicorn Server   ${GREEN}Running${RESET}  →  http://localhost:${PORT}"
    else
        fail "Uvicorn Server   ${RED}Stopped${RESET}"
    fi

    if is_ngrok_running; then
        NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -oP '"public_url":"https://[^"]+' | head -1 | cut -d'"' -f4)
        if [[ -n "$NGROK_URL" ]]; then
            success "Ngrok            ${GREEN}Active${RESET}   →  $NGROK_URL"
        else
            success "Ngrok            ${GREEN}Active${RESET}   →  check http://127.0.0.1:4040"
        fi
    else
        echo -e "  ${DIM}○${RESET}  Ngrok            ${DIM}Not running${RESET}"
    fi

    press_enter
}

# ─── 2. Start ────────────────────────────────────────────────
start_menu() {
    banner
    echo -e "  ${BOLD}Start Services${RESET}"
    divider
    echo ""
    echo -e "  ${CYAN}1${RESET})  Start Local       ${DIM}(localhost:${PORT} only)${RESET}"
    echo -e "  ${CYAN}2${RESET})  Start Public       ${DIM}(localhost:${PORT} + ngrok tunnel)${RESET}"
    echo -e "  ${CYAN}3${RESET})  Start Ngrok Only   ${DIM}(server already running)${RESET}"
    echo -e "  ${CYAN}0${RESET})  Back"
    echo ""
    read -rp "  Select: " choice

    case $choice in
        1) do_start false ;;
        2) do_start true ;;
        3) do_ngrok_only ;;
        0|"") return ;;
        *) warn "Invalid option." && sleep 1 ;;
    esac
}

do_start() {
    local with_ngrok=$1
    banner
    echo -e "  ${BOLD}Starting OpenRun...${RESET}"
    divider
    echo ""

    if is_server_running; then
        success "Server is already running"
    else
        if [ ! -d "$VENV_DIR" ]; then
            fail "Virtual environment not found. Please install dependencies first."
            press_enter
            return
        fi

        info "Starting backend server on port ${PORT}..."
        # Prevent "address already in use" errors by clearing the port
        fuser -k ${PORT}/tcp 2>/dev/null
        
        source $VENV_DIR/bin/activate
        uvicorn main:app --host 0.0.0.0 --port $PORT &>/dev/null &
        sleep 2
        
        if is_server_running; then
            success "Server started at http://localhost:${PORT}"
        else
            fail "Server failed to start."
        fi
    fi

    if $with_ngrok; then
        echo ""
        do_ngrok_only_inner
    fi

    press_enter
}

do_ngrok_only() {
    banner
    echo -e "  ${BOLD}Starting Ngrok Tunnel${RESET}"
    divider
    echo ""

    if ! is_server_running; then
        warn "Server is not running. Starting it first..."
        fuser -k ${PORT}/tcp 2>/dev/null
        source $VENV_DIR/bin/activate
        uvicorn main:app --host 0.0.0.0 --port $PORT &>/dev/null &
        sleep 2
    fi

    do_ngrok_only_inner
    press_enter
}

do_ngrok_only_inner() {
    if ! command -v ngrok &>/dev/null; then
        fail "Ngrok is not installed."
        return
    fi

    if is_ngrok_running; then
        success "Ngrok is already running"
        NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -oP '"public_url":"https://[^"]+' | head -1 | cut -d'"' -f4)
        [[ -n "$NGROK_URL" ]] && success "Public URL: ${BOLD}$NGROK_URL${RESET}"
        return
    fi

    info "Starting ngrok..."
    ngrok http $PORT --log=stdout &>/dev/null &
    sleep 4

    NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -oP '"public_url":"https://[^"]+' | head -1 | cut -d'"' -f4)
    if [[ -n "$NGROK_URL" ]]; then
        success "Public URL: ${BOLD}$NGROK_URL${RESET}"
    else
        warn "Ngrok started but URL not available. Check http://127.0.0.1:4040"
    fi
}

# ─── 3. Stop ─────────────────────────────────────────────────
stop_menu() {
    banner
    echo -e "  ${BOLD}Stop Services${RESET}"
    divider
    echo ""
    echo -e "  ${CYAN}1${RESET})  Stop All           ${DIM}(ngrok + server)${RESET}"
    echo -e "  ${CYAN}2${RESET})  Stop Ngrok Only    ${DIM}(keep server running locally)${RESET}"
    echo -e "  ${CYAN}3${RESET})  Stop Server Only   ${DIM}(disconnect localhost:${PORT})${RESET}"
    echo -e "  ${CYAN}0${RESET})  Back"
    echo ""
    read -rp "  Select: " choice

    case $choice in
        1) do_stop_all ;;
        2) do_stop_ngrok ;;
        3) do_stop_server ;;
        0|"") return ;;
        *) warn "Invalid option." && sleep 1 ;;
    esac
}

do_stop_all() {
    banner
    echo -e "  ${BOLD}Stopping Everything...${RESET}"
    divider
    echo ""

    do_stop_ngrok_inner
    do_stop_server_inner

    press_enter
}

do_stop_ngrok() {
    banner
    do_stop_ngrok_inner
    press_enter
}

do_stop_ngrok_inner() {
    if is_ngrok_running; then
        pkill -f "ngrok http $PORT" 2>/dev/null
        success "Ngrok stopped"
    else
        echo -e "  ${DIM}○${RESET}  Ngrok was not running"
    fi
}

do_stop_server() {
    banner
    do_stop_server_inner
    press_enter
}

do_stop_server_inner() {
    if is_server_running; then
        pkill -f "uvicorn main:app" 2>/dev/null
        fuser -k ${PORT}/tcp 2>/dev/null
        success "Server stopped"
    else
        fuser -k ${PORT}/tcp 2>/dev/null
        echo -e "  ${DIM}○${RESET}  Server was not running"
    fi
}

# ─── 4. Rebuild Frontend ────────────────────────────────────
rebuild_frontend() {
    banner
    echo -e "  ${BOLD}Rebuild Frontend${RESET}"
    divider
    echo ""

    info "Building frontend (this may take a moment)..."
    echo ""

    cd $FRONTEND_DIR || return
    npm install
    npm run build
    cd ..

    echo ""
    success "Frontend rebuilt successfully!"
    press_enter
}

# ─── 5. Install Dependencies ────────────────────────────────
install_dependencies() {
    banner
    echo -e "  ${BOLD}Install Dependencies (Ubuntu/Debian)${RESET}"
    divider
    echo ""
    info "This will install Python, Node.js, Java (JDK), Ngrok, and Playwright."
    echo -e "  ${YELLOW}Note: You will be prompted for your sudo password to run apt-get.${RESET}"
    echo ""
    read -rp "  Proceed? [y/N]: " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        return
    fi

    echo ""
    info "Updating apt packages..."
    sudo apt-get update

    echo ""
    info "Installing Python, pip, OpenJDK, and utilities..."
    sudo apt-get install -y python3 python3-venv python3-pip openjdk-17-jdk curl wget psmisc

    echo ""
    info "Setting up Node.js..."
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        success "Node.js is already installed."
    fi

    echo ""
    info "Installing Ngrok..."
    if ! command -v ngrok &> /dev/null; then
        curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
        echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list >/dev/null
        sudo apt-get update
        sudo apt-get install -y ngrok
    else
        success "Ngrok is already installed."
    fi

    echo ""
    info "Setting up Python virtual environment..."
    if [ ! -d "$VENV_DIR" ]; then
        python3 -m venv $VENV_DIR
    fi
    source $VENV_DIR/bin/activate

    echo ""
    info "Installing Python packages..."
    pip install fastapi uvicorn playwright playwright-stealth pydantic

    echo ""
    info "Installing Playwright browsers and dependencies..."
    playwright install chromium
    # playwright install-deps uses sudo internally to install ubuntu packages
    playwright install-deps

    echo ""
    info "Installing Frontend dependencies..."
    if [ -d "$FRONTEND_DIR" ]; then
        cd $FRONTEND_DIR
        npm install
        cd ..
    fi

    echo ""
    success "All dependencies installed successfully!"
    press_enter
}

# ─── Main Menu ───────────────────────────────────────────────
main_menu() {
    while true; do
        banner

        # Quick status line
        echo -e "  Server: $(is_server_running && echo -e "${GREEN}●${RESET} Running" || echo -e "${RED}●${RESET} Stopped")    Ngrok: $(is_ngrok_running && echo -e "${GREEN}●${RESET} Active" || echo -e "${DIM}○ Off${RESET}")"

        echo ""
        divider
        echo ""
        echo -e "  ${CYAN}1${RESET})  ${BOLD}Start${RESET}             Launch the server & ngrok"
        echo -e "  ${CYAN}2${RESET})  ${BOLD}Stop${RESET}              Shut down services"
        echo -e "  ${CYAN}3${RESET})  ${BOLD}Status${RESET}            View detailed status and URLs"
        echo -e "  ${CYAN}4${RESET})  ${BOLD}Rebuild Frontend${RESET}  Rebuild the React app"
        echo -e "  ${CYAN}5${RESET})  ${BOLD}Install Setup${RESET}     Install all required dependencies"
        echo ""
        echo -e "  ${CYAN}0${RESET})  ${DIM}Exit${RESET}"
        echo ""
        read -rp "  Select: " choice

        case $choice in
            1) start_menu ;;
            2) stop_menu ;;
            3) show_status ;;
            4) rebuild_frontend ;;
            5) install_dependencies ;;
            0) echo "" && echo -e "  ${DIM}Goodbye! ☕${RESET}" && echo "" && exit 0 ;;
            *) warn "Invalid option." && sleep 1 ;;
        esac
    done
}

# ─── Entry Point ─────────────────────────────────────────────

# Warn if running as root
if [ "$EUID" -eq 0 ]; then
    warn "It is highly recommended NOT to run this entire script as root."
    warn "The dependency installer will safely prompt for sudo when needed."
    echo ""
    read -rp "  Press Enter to acknowledge and continue..." _
fi

main_menu
