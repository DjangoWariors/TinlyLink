#!/bin/bash

# =============================================================================
# TinlyLink Database Backup Script
# =============================================================================
# Creates timestamped backups with optional S3 upload
# Usage: ./backup.sh [action]
# Actions: backup, restore [filename], list
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
ACTION=${1:-backup}
RESTORE_FILE=${2:-}
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Load environment
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Database settings
DB_NAME=${POSTGRES_DB:-tinlylink}
DB_USER=${POSTGRES_USER:-tinlylink}
DB_HOST=${POSTGRES_HOST:-db}
DB_PORT=${POSTGRES_PORT:-5432}

# S3 settings (optional)
S3_BUCKET=${BACKUP_S3_BUCKET:-}
S3_PREFIX=${BACKUP_S3_PREFIX:-backups/tinlylink}

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}TinlyLink Database Backup${NC}"
echo -e "${GREEN}Action: ${YELLOW}${ACTION}${NC}"
echo -e "${GREEN}================================================${NC}"

# Create backup directory if it doesn't exist
mkdir -p ${BACKUP_DIR}

backup() {
    BACKUP_FILE="${BACKUP_DIR}/tinlylink_${TIMESTAMP}.sql.gz"
    
    echo -e "${YELLOW}Creating backup...${NC}"
    
    # Create backup using pg_dump
    PGPASSWORD=${POSTGRES_PASSWORD} pg_dump \
        -h ${DB_HOST} \
        -p ${DB_PORT} \
        -U ${DB_USER} \
        -d ${DB_NAME} \
        --no-owner \
        --no-acl \
        --clean \
        --if-exists \
        | gzip > ${BACKUP_FILE}
    
    # Check if backup was successful
    if [ -f "${BACKUP_FILE}" ] && [ -s "${BACKUP_FILE}" ]; then
        echo -e "${GREEN}✓ Backup created: ${BACKUP_FILE}${NC}"
        echo -e "${GREEN}  Size: $(du -h ${BACKUP_FILE} | cut -f1)${NC}"
    else
        echo -e "${RED}✗ Backup failed${NC}"
        exit 1
    fi
    
    # Upload to S3 if configured
    if [ -n "${S3_BUCKET}" ]; then
        echo -e "${YELLOW}Uploading to S3...${NC}"
        aws s3 cp ${BACKUP_FILE} s3://${S3_BUCKET}/${S3_PREFIX}/$(basename ${BACKUP_FILE})
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Uploaded to S3${NC}"
        else
            echo -e "${YELLOW}⚠ S3 upload failed (backup still saved locally)${NC}"
        fi
    fi
    
    # Clean up old backups
    cleanup
    
    echo -e "${GREEN}Backup completed!${NC}"
}

restore() {
    if [ -z "${RESTORE_FILE}" ]; then
        echo -e "${RED}Error: Please specify a backup file to restore${NC}"
        echo "Usage: $0 restore <backup_file>"
        exit 1
    fi
    
    # Check if file exists locally
    if [ ! -f "${RESTORE_FILE}" ]; then
        # Try backup directory
        if [ -f "${BACKUP_DIR}/${RESTORE_FILE}" ]; then
            RESTORE_FILE="${BACKUP_DIR}/${RESTORE_FILE}"
        # Try downloading from S3
        elif [ -n "${S3_BUCKET}" ]; then
            echo -e "${YELLOW}Downloading from S3...${NC}"
            aws s3 cp s3://${S3_BUCKET}/${S3_PREFIX}/${RESTORE_FILE} ${BACKUP_DIR}/${RESTORE_FILE}
            RESTORE_FILE="${BACKUP_DIR}/${RESTORE_FILE}"
        else
            echo -e "${RED}Error: Backup file not found: ${RESTORE_FILE}${NC}"
            exit 1
        fi
    fi
    
    echo -e "${YELLOW}WARNING: This will replace all data in the database!${NC}"
    echo -e "${YELLOW}Database: ${DB_NAME}${NC}"
    echo -e "${YELLOW}Backup file: ${RESTORE_FILE}${NC}"
    read -p "Are you sure you want to continue? (yes/no): " CONFIRM
    
    if [ "${CONFIRM}" != "yes" ]; then
        echo -e "${YELLOW}Restore cancelled${NC}"
        exit 0
    fi
    
    echo -e "${YELLOW}Restoring database...${NC}"
    
    # Restore from backup
    if [[ ${RESTORE_FILE} == *.gz ]]; then
        gunzip -c ${RESTORE_FILE} | PGPASSWORD=${POSTGRES_PASSWORD} psql \
            -h ${DB_HOST} \
            -p ${DB_PORT} \
            -U ${DB_USER} \
            -d ${DB_NAME}
    else
        PGPASSWORD=${POSTGRES_PASSWORD} psql \
            -h ${DB_HOST} \
            -p ${DB_PORT} \
            -U ${DB_USER} \
            -d ${DB_NAME} \
            < ${RESTORE_FILE}
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Database restored successfully${NC}"
    else
        echo -e "${RED}✗ Restore failed${NC}"
        exit 1
    fi
}

cleanup() {
    echo -e "${YELLOW}Cleaning up old backups (older than ${RETENTION_DAYS} days)...${NC}"
    
    # Remove local backups older than retention period
    find ${BACKUP_DIR} -name "tinlylink_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
    
    # Clean up S3 if configured
    if [ -n "${S3_BUCKET}" ]; then
        # List and delete old files
        CUTOFF_DATE=$(date -d "${RETENTION_DAYS} days ago" +%Y-%m-%d)
        aws s3 ls s3://${S3_BUCKET}/${S3_PREFIX}/ | while read -r line; do
            FILE_DATE=$(echo $line | awk '{print $1}')
            FILE_NAME=$(echo $line | awk '{print $4}')
            if [[ "${FILE_DATE}" < "${CUTOFF_DATE}" ]]; then
                aws s3 rm s3://${S3_BUCKET}/${S3_PREFIX}/${FILE_NAME}
            fi
        done
    fi
    
    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

list_backups() {
    echo -e "${GREEN}Local backups:${NC}"
    ls -lh ${BACKUP_DIR}/tinlylink_*.sql.gz 2>/dev/null || echo "  No local backups found"
    
    if [ -n "${S3_BUCKET}" ]; then
        echo -e "\n${GREEN}S3 backups:${NC}"
        aws s3 ls s3://${S3_BUCKET}/${S3_PREFIX}/ 2>/dev/null || echo "  No S3 backups or bucket not accessible"
    fi
}

# Execute action
case "$ACTION" in
    backup)
        backup
        ;;
    restore)
        restore
        ;;
    list)
        list_backups
        ;;
    cleanup)
        cleanup
        ;;
    *)
        echo -e "${RED}Unknown action: ${ACTION}${NC}"
        echo "Usage: $0 [action] [options]"
        echo "Actions: backup, restore <file>, list, cleanup"
        exit 1
        ;;
esac
