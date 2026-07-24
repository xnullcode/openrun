#!/bin/bash

# Configuration
PORT=8000

# ─── Colors ──────────────────────────────────────────────────
BOLD='\033[1m'
DIM='\033[2m'
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
RESET='\033[0m'

# ─── Helpers ─────────────────────────────────────────────────
DOCKER_CMD="docker"
if ! docker ps &>/dev/null; then
    DOCKER_CMD="sudo docker"
fi

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
    $DOCKER_CMD ps | grep -q "openrun_app"
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
        success "Docker Container ${GREEN}Running${RESET}  →  http://localhost:${PORT}"
    else
        fail "Docker Container ${RED}Stopped${RESET}"
    fi

    if is_ngrok_running; then
        NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -oP '"public_url":"https://[^"]+' | head -1 | cut -d'"' -f4)
        if [[ -n "$NGROK_URL" ]]; then
            success "Ngrok Tunnel     ${GREEN}Running${RESET}  →  $NGROK_URL"
        else
            warn "Ngrok Tunnel     ${YELLOW}Running${RESET}  →  (URL pending)"
        fi
    else
        echo -e "  ${DIM}○${RESET}  Ngrok Tunnel     ${DIM}Stopped${RESET}"
    fi
    echo ""
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
    echo -e "  ${BOLD}Starting OpenRun (Docker)...${RESET}"
    divider
    echo ""

    if ! command -v docker &> /dev/null; then
        fail "Docker is not installed on this system. Please install Docker first."
        press_enter
        return
    fi

    if is_server_running; then
        success "Docker container is already running."
    else
        info "Clearing port ${PORT}..."
        fuser -k ${PORT}/tcp 2>/dev/null
        sleep 1

        info "Building and starting Docker container..."
        $DOCKER_CMD compose up -d --build
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

do_rebuild() {
    banner
    echo -e "  ${BOLD}Rebuilding OpenRun...${RESET}"
    divider
    echo ""
    info "Forcing a clean rebuild of the Docker image..."
    if $DOCKER_CMD compose up -d --build --force-recreate; then
        sleep 2
        if is_server_running; then
            success "Server successfully rebuilt and started!"
        else
            fail "Server failed to start after rebuild."
        fi
    else
        fail "Docker build failed! Please check the errors above."
    fi
    press_enter
}

do_ngrok_only() {
    banner
    echo -e "  ${BOLD}Starting Ngrok Tunnel${RESET}"
    divider
    echo ""

    if ! is_server_running; then
        warn "Docker container is not running. Starting it first..."
        fuser -k ${PORT}/tcp 2>/dev/null
        sleep 1
        $DOCKER_CMD compose up -d
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
    info "Stopping services..."

    do_stop_server_inner
    
    if is_ngrok_running; then
        pkill -f "ngrok http $PORT" &>/dev/null
        success "Ngrok stopped"
    else
        echo -e "  ${DIM}○${RESET}  Ngrok was not running"
    fi

    echo ""
    press_enter
}

do_stop_server_inner() {
    if is_server_running; then
        $DOCKER_CMD compose down
        success "Docker container stopped"
    else
        echo -e "  ${DIM}○${RESET}  Docker container was not running"
    fi
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
        echo -e "  ${CYAN}1${RESET})  ${BOLD}Start${RESET}             Launch in Docker & ngrok"
        echo -e "  ${CYAN}2${RESET})  ${BOLD}Stop${RESET}              Shut down services"
        echo -e "  ${CYAN}3${RESET})  ${BOLD}Status${RESET}            View detailed status and URLs"
        echo -e "  ${CYAN}4${RESET})  ${BOLD}Rebuild${RESET}           Force rebuild of the Docker image"
        echo ""
        echo -e "  ${CYAN}0${RESET})  ${DIM}Exit${RESET}"
        echo ""
        read -rp "  Select: " choice

        case $choice in
            1) start_menu ;;
            2) stop_menu ;;
            3) show_status ;;
            4) do_rebuild ;;
            0) echo "" && echo -e "  ${DIM}Goodbye! ☕${RESET}" && echo "" && exit 0 ;;
            *) warn "Invalid option." && sleep 1 ;;
        esac
    done
}

# Warn if running as root
if [ "$EUID" -eq 0 ]; then
    warn "It is highly recommended NOT to run this script as root."
    sleep 2
fi

main_menu
