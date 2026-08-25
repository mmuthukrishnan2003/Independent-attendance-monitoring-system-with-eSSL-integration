pipeline {

    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(
            numToKeepStr: '10',
            artifactNumToKeepStr: '5'
        ))
    }

    environment {
        APP_NAME = 'essl-monitor'
        APP_DIR = '/opt/essl-monitor'
        DEPLOY_DIR = '/opt/essl-monitor/current'
        BACKUP_DIR = '/opt/essl-monitor/backup'

        PROJECT_DIR = 'essl-monitor/backend'

        PORT = '5001'
        HOST = '127.0.0.1'

        GIT_BRANCH_NAME = 'main'
    }

    stages {

        stage('Environment Check') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        ENVIRONMENT CHECK"
                    echo "=========================================="

                    echo "Jenkins user:"
                    whoami

                    echo "Node:"
                    node -v

                    echo "NPM:"
                    npm -v

                    echo "Git:"
                    git --version

                    echo "PostgreSQL:"
                    psql --version

                    echo "PM2:"
                    pm2 -v

                    echo "=========================================="
                '''
            }
        }

        stage('Validate Project') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        VALIDATING PROJECT"
                    echo "=========================================="

                    test -d "${PROJECT_DIR}"
                    test -f "${PROJECT_DIR}/package.json"
                    test -f "${PROJECT_DIR}/package-lock.json"
                    test -f "${PROJECT_DIR}/src/server.js"

                    if [ ! -f "${PROJECT_DIR}/src/db/migrate.js" ]; then
                        echo "WARNING: migrate.js not found."
                        echo "Database migration will be skipped."
                    else
                        echo "Migration file found."
                    fi

                    echo "Project structure OK"
                '''
            }
        }

        stage('Check Server Environment') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        CHECKING SERVER"
                    echo "=========================================="

                    test -d "${APP_DIR}"

                    if [ ! -f "${APP_DIR}/.env" ]; then
                        echo "ERROR: ${APP_DIR}/.env not found."
                        exit 1
                    fi

                    echo ".env found"

                    # Load environment without printing password
                    set -a
                    . "${APP_DIR}/.env"
                    set +a

                    : "${DB_HOST:?DB_HOST missing}"
                    : "${DB_PORT:?DB_PORT missing}"
                    : "${DB_NAME:?DB_NAME missing}"
                    : "${DB_USER:?DB_USER missing}"
                    : "${DB_PASSWORD:?DB_PASSWORD missing}"

                    echo "Database host: ${DB_HOST}"
                    echo "Database port: ${DB_PORT}"
                    echo "Database name: ${DB_NAME}"
                    echo "Database user: ${DB_USER}"
                    echo "Database password: configured"

                    echo "Server configuration OK"
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                dir("${PROJECT_DIR}") {
                    sh '''
                        set -eu

                        echo "=========================================="
                        echo "        INSTALLING DEPENDENCIES"
                        echo "=========================================="

                        npm ci

                        echo "Dependencies installed successfully"
                    '''
                }
            }
        }

        stage('Test PostgreSQL') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        POSTGRESQL CONNECTION"
                    echo "=========================================="

                    set -a
                    . "${APP_DIR}/.env"
                    set +a

                    PGPASSWORD="${DB_PASSWORD}" psql \
                        -h "${DB_HOST}" \
                        -p "${DB_PORT}" \
                        -U "${DB_USER}" \
                        -d "${DB_NAME}" \
                        -c "SELECT current_database(), current_user;"

                    echo "PostgreSQL connection successful"
                '''
            }
        }

        stage('Prepare Backup') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        PREPARING BACKUP"
                    echo "=========================================="

                    mkdir -p "${BACKUP_DIR}"

                    if [ -d "${DEPLOY_DIR}" ]; then

                        BACKUP_NAME="${BACKUP_DIR}/backup-$(date +%Y%m%d-%H%M%S)"

                        echo "Creating application backup:"
                        echo "${BACKUP_NAME}"

                        mkdir -p "${BACKUP_NAME}"

                        cp -a "${DEPLOY_DIR}/." "${BACKUP_NAME}/"

                        echo "Application backup created"

                    else
                        echo "No previous deployment found."
                    fi
                '''
            }
        }

        stage('Prepare Deployment') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        PREPARING DEPLOYMENT"
                    echo "=========================================="

                    TEMP_DIR="${APP_DIR}/deploy-${BUILD_NUMBER}"

                    rm -rf "${TEMP_DIR}"
                    mkdir -p "${TEMP_DIR}"

                    cp "${PROJECT_DIR}/package.json" \
                       "${TEMP_DIR}/"

                    cp "${PROJECT_DIR}/package-lock.json" \
                       "${TEMP_DIR}/"

                    cp -r "${PROJECT_DIR}/src" \
                       "${TEMP_DIR}/"

                    cp "${APP_DIR}/.env" \
                       "${TEMP_DIR}/.env"

                    echo "Installing production dependencies..."

                    cd "${TEMP_DIR}"

                    npm ci --omit=dev

                    echo "Production dependencies installed"

                    echo "Deployment directory prepared:"
                    echo "${TEMP_DIR}"
                '''
            }
        }

        stage('Verify Deployment Environment') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        VERIFYING DEPLOYMENT"
                    echo "=========================================="

                    TEMP_DIR="${APP_DIR}/deploy-${BUILD_NUMBER}"

                    cd "${TEMP_DIR}"

                    test -f package.json
                    test -f package-lock.json
                    test -f src/server.js
                    test -f .env

                    echo "Application files verified"
                '''
            }
        }

        stage('Database Migration') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        DATABASE MIGRATION"
                    echo "=========================================="

                    TEMP_DIR="${APP_DIR}/deploy-${BUILD_NUMBER}"

                    cd "${TEMP_DIR}"

                    if [ ! -f src/db/migrate.js ]; then
                        echo "Migration file not found."
                        echo "Skipping migration."
                        exit 0
                    fi

                    # Load server environment
                    set -a
                    . "${APP_DIR}/.env"
                    set +a

                    # IMPORTANT:
                    # Export both common naming formats.
                    # This protects the migration script if it uses
                    # DATABASE_* instead of DB_* variables.

                    export DB_HOST="${DB_HOST}"
                    export DB_PORT="${DB_PORT}"
                    export DB_NAME="${DB_NAME}"
                    export DB_USER="${DB_USER}"
                    export DB_PASSWORD="${DB_PASSWORD}"

                    export DATABASE_HOST="${DB_HOST}"
                    export DATABASE_PORT="${DB_PORT}"
                    export DATABASE_NAME="${DB_NAME}"
                    export DATABASE_USER="${DB_USER}"
                    export DATABASE_PASSWORD="${DB_PASSWORD}"

                    export PGHOST="${DB_HOST}"
                    export PGPORT="${DB_PORT}"
                    export PGDATABASE="${DB_NAME}"
                    export PGUSER="${DB_USER}"
                    export PGPASSWORD="${DB_PASSWORD}"

                    # Also provide DATABASE_URL for applications
                    # that use PostgreSQL connection strings.
                    export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

                    echo "Database:"
                    echo "  Host: ${DB_HOST}"
                    echo "  Port: ${DB_PORT}"
                    echo "  Name: ${DB_NAME}"
                    echo "  User: ${DB_USER}"

                    echo ""
                    echo "Running database migration..."

                    node src/db/migrate.js

                    echo ""
                    echo "Database migration completed successfully."
                '''
            }
        }

        stage('Application Syntax Test') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        APPLICATION TEST"
                    echo "=========================================="

                    TEMP_DIR="${APP_DIR}/deploy-${BUILD_NUMBER}"

                    node --check "${TEMP_DIR}/src/server.js"

                    if [ -f "${TEMP_DIR}/src/db/migrate.js" ]; then
                        node --check "${TEMP_DIR}/src/db/migrate.js"
                    fi

                    echo "Application syntax OK"
                '''
            }
        }

        stage('Deploy Application') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        DEPLOYING APPLICATION"
                    echo "=========================================="

                    TEMP_DIR="${APP_DIR}/deploy-${BUILD_NUMBER}"

                    # Stop previous PM2 application if running
                    pm2 delete "${APP_NAME}" 2>/dev/null || true

                    # Replace current deployment
                    rm -rf "${DEPLOY_DIR}"

                    mv "${TEMP_DIR}" "${DEPLOY_DIR}"

                    echo "Application deployed to:"
                    echo "${DEPLOY_DIR}"

                    cd "${DEPLOY_DIR}"

                    # Start application using PM2
                    pm2 start src/server.js \
                        --name "${APP_NAME}" \
                        --time \
                        --update-env

                    pm2 save

                    echo "PM2 application started"
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        HEALTH CHECK"
                    echo "=========================================="

                    sleep 5

                    echo "PM2 status:"
                    pm2 status

                    echo ""
                    echo "Checking application port ${PORT}..."

                    if curl -fsS \
                        --connect-timeout 5 \
                        --max-time 10 \
                        "http://${HOST}:${PORT}/" \
                        > /tmp/essl-health-response.txt; then

                        echo "Application health check PASSED"

                    else

                        echo "Application health check FAILED"

                        echo ""
                        echo "Recent PM2 logs:"
                        pm2 logs "${APP_NAME}" --lines 50 --nostream || true

                        exit 1
                    fi
                '''
            }
        }

        stage('Deployment Information') {
            steps {
                sh '''
                    echo "=========================================="
                    echo "      DEPLOYMENT SUCCESSFUL"
                    echo "=========================================="

                    echo ""
                    echo "Application : ${APP_NAME}"
                    echo "Directory   : ${DEPLOY_DIR}"
                    echo "Port        : ${PORT}"
                    echo "URL         : http://localhost:${PORT}"
                    echo ""

                    echo "PM2 status:"
                    pm2 status

                    echo ""
                    echo "Deployment completed successfully."
                '''
            }
        }
    }

    post {

        success {
            echo '''
==============================================
       eSSL ATTENDANCE MONITOR
       DEPLOYMENT SUCCESSFUL
==============================================
'''
        }

        failure {
            echo '''
==============================================
       eSSL ATTENDANCE MONITOR
       DEPLOYMENT FAILED
==============================================
'''
            sh '''
                echo "PM2 status:"
                pm2 status || true

                echo ""
                echo "Recent application logs:"
                pm2 logs "${APP_NAME}" --lines 50 --nostream || true
            '''
        }

        always {
            sh '''
                echo ""
                echo "Jenkins deployment process completed."
                echo ""
            '''
        }
    }
}
