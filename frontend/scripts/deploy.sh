#!/bin/bash
# =============================================================================
# TINLYLINK FRONTEND DEPLOYMENT SCRIPT
# =============================================================================

set -e

# Configuration
APP_NAME="tinlylink-frontend"
DEPLOY_DIR="/opt/tinlylink-frontend"
BUILD_DIR="./dist"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check Node.js version
check_node() {
    log_info "Checking Node.js version..."
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js 18+ required. Current: $(node -v)"
        exit 1
    fi
    log_info "Node.js $(node -v) ✓"
}

# Install dependencies
install_deps() {
    log_info "Installing dependencies..."
    npm ci --legacy-peer-deps
    log_info "Dependencies installed ✓"
}

# Run tests
run_tests() {
    log_info "Running tests..."
    npm run test:run || {
        log_error "Tests failed!"
        exit 1
    }
    log_info "Tests passed ✓"
}

# Run linting
run_lint() {
    log_info "Running linter..."
    npm run lint || {
        log_warn "Linting issues found"
    }
    log_info "Linting complete ✓"
}

# Build application
build_app() {
    log_info "Building application..."
    
    # Set production environment
    export NODE_ENV=production
    
    npm run build || {
        log_error "Build failed!"
        exit 1
    }
    
    log_info "Build complete ✓"
}

# Build Docker image
build_docker() {
    log_info "Building Docker image..."
    
    docker build \
        --build-arg VITE_API_URL="${VITE_API_URL:-/api/v1}" \
        --build-arg VITE_STRIPE_PUBLISHABLE_KEY="${VITE_STRIPE_PUBLISHABLE_KEY:-}" \
        --build-arg VITE_GA_TRACKING_ID="${VITE_GA_TRACKING_ID:-}" \
        --build-arg VITE_SENTRY_DSN="${VITE_SENTRY_DSN:-}" \
        -t "${APP_NAME}:latest" \
        -t "${APP_NAME}:$(git rev-parse --short HEAD)" \
        .
    
    log_info "Docker image built ✓"
}

# Deploy with Docker
deploy_docker() {
    log_info "Deploying with Docker..."
    
    docker compose down --remove-orphans || true
    docker compose up -d
    
    log_info "Deployment complete ✓"
}

# Deploy to static hosting
deploy_static() {
    local target="${1:-$DEPLOY_DIR}"
    
    log_info "Deploying to static hosting at ${target}..."
    
    # Create deploy directory
    mkdir -p "$target"
    
    # Copy build files
    cp -r "$BUILD_DIR"/* "$target/"
    
    log_info "Static deployment complete ✓"
}

# Health check
health_check() {
    log_info "Running health check..."
    
    local url="${1:-http://localhost:80}"
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -sf "${url}/health" > /dev/null 2>&1; then
            log_info "Health check passed ✓"
            return 0
        fi
        
        log_info "Waiting for service... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    log_error "Health check failed after $max_attempts attempts"
    return 1
}

# Show usage
usage() {
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  build       Build the application"
    echo "  test        Run tests"
    echo "  lint        Run linter"
    echo "  docker      Build Docker image"
    echo "  deploy      Deploy with Docker Compose"
    echo "  static      Deploy to static directory"
    echo "  full        Full deployment (test, build, docker, deploy)"
    echo "  health      Run health check"
    echo ""
}

# Main
case "${1:-}" in
    build)
        check_node
        install_deps
        build_app
        ;;
    test)
        check_node
        install_deps
        run_tests
        ;;
    lint)
        check_node
        install_deps
        run_lint
        ;;
    docker)
        build_docker
        ;;
    deploy)
        deploy_docker
        health_check
        ;;
    static)
        deploy_static "$2"
        ;;
    full)
        check_node
        install_deps
        run_lint
        run_tests
        build_app
        build_docker
        deploy_docker
        health_check
        log_info "Full deployment complete! 🚀"
        ;;
    health)
        health_check "$2"
        ;;
    *)
        usage
        exit 1
        ;;
esac
