#!/bin/bash

# =============================================================================
# TinlyLink Deployment Script
# =============================================================================
# Usage: ./deploy.sh [environment] [action]
# Environments: production, staging
# Actions: deploy, rollback, restart, status
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
ACTION=${2:-deploy}
COMPOSE_FILE="docker-compose.prod.yml"
PROJECT_NAME="tinlylink-${ENVIRONMENT}"

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}TinlyLink Deployment Script${NC}"
echo -e "${GREEN}Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "${GREEN}Action: ${YELLOW}${ACTION}${NC}"
echo -e "${GREEN}================================================${NC}"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(production|staging)$ ]]; then
    echo -e "${RED}Error: Invalid environment. Use 'production' or 'staging'${NC}"
    exit 1
fi

# Load environment file
ENV_FILE=".env.${ENVIRONMENT}"
if [ -f "$ENV_FILE" ]; then
    echo -e "${GREEN}Loading environment from ${ENV_FILE}${NC}"
    export $(cat "$ENV_FILE" | grep -v '^#' | xargs)
else
    echo -e "${YELLOW}Warning: ${ENV_FILE} not found, using .env${NC}"
    if [ -f ".env" ]; then
        export $(cat ".env" | grep -v '^#' | xargs)
    else
        echo -e "${RED}Error: No environment file found${NC}"
        exit 1
    fi
fi

# Functions
deploy() {
    echo -e "${GREEN}Starting deployment...${NC}"
    
    # Pull latest changes
    echo -e "${YELLOW}Pulling latest code...${NC}"
    git pull origin main
    
    # Build images
    echo -e "${YELLOW}Building Docker images...${NC}"
    docker compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} build
    
    # Run database migrations
    echo -e "${YELLOW}Running database migrations...${NC}"
    docker compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} run --rm api python manage.py migrate --noinput
    
    # Collect static files
    echo -e "${YELLOW}Collecting static files...${NC}"
    docker compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} run --rm api python manage.py collectstatic --noinput
    
    # Deploy with zero-downtime
    echo -e "${YELLOW}Deploying services...${NC}"
    docker compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} up -d --remove-orphans
    
    # Wait for health checks
    echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
    sleep 10
    
    # Check health
    check_health
    
    # Cleanup old images
    echo -e "${YELLOW}Cleaning up old images...${NC}"
    docker image prune -f
    
    echo -e "${GREEN}Deployment completed successfully!${NC}"
}

rollback() {
    echo -e "${YELLOW}Rolling back to previous version...${NC}"
    
    # Get previous image tag
    PREVIOUS_TAG=$(docker images --format "{{.Tag}}" "${PROJECT_NAME}_api" | sed -n '2p')
    
    if [ -z "$PREVIOUS_TAG" ]; then
        echo -e "${RED}Error: No previous version found to rollback${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Rolling back to tag: ${PREVIOUS_TAG}${NC}"
    
    # Restart with previous version
    docker compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} up -d --no-build
    
    echo -e "${GREEN}Rollback completed!${NC}"
}

restart() {
    echo -e "${YELLOW}Restarting services...${NC}"
    docker compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} restart
    echo -e "${GREEN}Services restarted!${NC}"
}

status() {
    echo -e "${GREEN}Service Status:${NC}"
    docker compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} ps
    
    echo -e "\n${GREEN}Container Logs (last 20 lines):${NC}"
    docker compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} logs --tail=20
    
    echo -e "\n${GREEN}Health Check:${NC}"
    check_health
}

check_health() {
    # Check API health
    API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health/ || echo "000")
    
    if [ "$API_HEALTH" == "200" ]; then
        echo -e "${GREEN}✓ API is healthy${NC}"
    else
        echo -e "${RED}✗ API is unhealthy (HTTP ${API_HEALTH})${NC}"
        return 1
    fi
    
    # Check readiness
    READY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ready/ || echo "000")
    
    if [ "$READY_STATUS" == "200" ]; then
        echo -e "${GREEN}✓ All dependencies are ready${NC}"
    else
        echo -e "${YELLOW}⚠ Some dependencies may not be ready (HTTP ${READY_STATUS})${NC}"
    fi
}

stop() {
    echo -e "${YELLOW}Stopping all services...${NC}"
    docker compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} down
    echo -e "${GREEN}Services stopped!${NC}"
}

logs() {
    echo -e "${GREEN}Tailing logs (Ctrl+C to exit)...${NC}"
    docker compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} logs -f
}

shell() {
    echo -e "${GREEN}Opening Django shell...${NC}"
    docker compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} exec api python manage.py shell
}

# Execute action
case "$ACTION" in
    deploy)
        deploy
        ;;
    rollback)
        rollback
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    stop)
        stop
        ;;
    logs)
        logs
        ;;
    shell)
        shell
        ;;
    *)
        echo -e "${RED}Unknown action: ${ACTION}${NC}"
        echo "Usage: $0 [environment] [action]"
        echo "Actions: deploy, rollback, restart, status, stop, logs, shell"
        exit 1
        ;;
esac
