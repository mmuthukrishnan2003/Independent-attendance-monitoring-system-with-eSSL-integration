pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout(false)
        buildDiscarder(logRotator(
            numToKeepStr: '10',
            artifactNumToKeepStr: '5'
        ))
    }

    environment {
        APP_NAME = 'essl-monitor'
        APP_ROOT = '/opt/essl-monitor'
        APP_DIR = '/opt/essl-monitor/current'
        BACKUP_DIR = '/opt/essl-monitor/backup'
        ENV_FILE = '/opt/essl-monitor/.env'

        APP_PORT = '5001'
    }

    stages {

        stage('Environment Check') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        ENVIRONMENT CHECK"
                    echo "=========================================="

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

                    echo "Jenkins user:"
                    whoami

                    echo "=========================================="
                '''
            }
        }

        stage('Checkout') {
            steps {
                echo 'Checking out GitHub repository...'
                checkout scm
            }
        }

        stage('Validate Project') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        VALIDATING PROJECT"
                    echo "=========================================="

                    test -d essl-monitor/backend
                    test -f essl-monitor/backend/package.json
                    test -f essl-monitor/backend/package-lock.json
                    test -f essl-monitor/backend/src/server.js

                    if [ ! -f essl-monitor/backend/src/db/migrate.js ]; then
                        echo "WARNING: migrate.js not found"
                        echo "Database migration stage will be skipped."
                    fi

                    echo "Project structure OK"
                '''
            }
        }

        stage('Check Server') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        CHECKING SERVER"
                    echo "=========================================="

                    if [ ! -d "$APP_ROOT" ]; then
                        echo "Creating $APP_ROOT"
                        mkdir -p "$APP_ROOT"
                    fi

                    if [ ! -f "$ENV_FILE" ]; then
                        echo ""
                        echo "ERROR: $ENV_FILE not found."
                        echo ""
                        echo "Create it on the server:"
                        echo "sudo nano /opt/essl-monitor/.env"
                        echo ""
                        exit 1
                    fi

                    echo ".env found"

                    set -a
                    . "$ENV_FILE"
                    set +a

                    : "${DB_HOST:?DB_HOST missing}"
                    : "${DB_PORT:?DB_PORT missing}"
                    : "${DB_NAME:?DB_NAME missing}"
                    : "${DB_USER:?DB_USER missing}"
                    : "${DB_PASSWORD:?DB_PASSWORD missing}"

                    echo "Database host: $DB_HOST"
                    echo "Database port: $DB_PORT"
                    echo "Database name: $DB_NAME"
                    echo "Database user: $DB_USER"
                    echo "Database password: configured"

                    echo "Server configuration OK"
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        INSTALLING DEPENDENCIES"
                    echo "=========================================="

                    cd essl-monitor/backend

                    npm ci

                    echo "Dependencies installed successfully"
                '''
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
                    . "$ENV_FILE"
                    set +a

                    PGPASSWORD="$DB_PASSWORD" \
                    psql \
                        -h "$DB_HOST" \
                        -p "$DB_PORT" \
                        -U "$DB_USER" \
                        -d "$DB_NAME" \
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

                    mkdir -p "$BACKUP_DIR"

                    if [ -d "$APP_DIR" ]; then

                        BACKUP_NAME="$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S)"

                        echo "Creating backup:"
                        echo "$BACKUP_NAME"

                        mkdir -p "$BACKUP_NAME"

                        cp -a "$APP_DIR/." "$BACKUP_NAME/"

                        echo "Backup created"
                    else
                        echo "No previous deployment found"
                    fi
                '''
            }
        }

        stage('Deploy Files') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        DEPLOYING APPLICATION"
                    echo "=========================================="

                    TEMP_DIR="$APP_ROOT/deploy-${BUILD_NUMBER}"

                    rm -rf "$TEMP_DIR"
                    mkdir -p "$TEMP_DIR"

                    cp essl-monitor/backend/package.json "$TEMP_DIR/"
                    cp essl-monitor/backend/package-lock.json "$TEMP_DIR/"

                    cp -r essl-monitor/backend/src "$TEMP_DIR/"

                    cp "$ENV_FILE" "$TEMP_DIR/.env"

                    echo "Installing production dependencies..."

                    cd "$TEMP_DIR"

                    npm ci --omit=dev

                    echo "Deployment files prepared"

                    rm -rf "$APP_DIR"

                    mv "$TEMP_DIR" "$APP_DIR"

                    echo "Application deployed to:"
                    echo "$APP_DIR"
                '''
            }
        }

        stage('Verify Environment') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        VERIFYING APPLICATION ENV"
                    echo "=========================================="

                    cd "$APP_DIR"

                    test -f package.json
                    test -f package-lock.json
                    test -f src/server.js
                    test -f .env

                    set -a
                    . ./.env
                    set +a

                    : "${DB_HOST:?DB_HOST missing}"
                    : "${DB_PORT:?DB_PORT missing}"
                    : "${DB_NAME:?DB_NAME missing}"
                    : "${DB_USER:?DB_USER missing}"
                    : "${DB_PASSWORD:?DB_PASSWORD missing}"

                    echo "Application environment OK"
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

                    cd "$APP_DIR"

                    if [ ! -f src/db/migrate.js ]; then
                        echo "No migration file found."
                        echo "Skipping migration."
                        exit 0
                    fi

                    set -a
                    . ./.env
                    set +a

                    export DB_HOST
                    export DB_PORT
                    export DB_NAME
                    export DB_USER
                    export DB_PASSWORD

                    echo "Database: $DB_NAME"
                    echo "Host: $DB_HOST"
                    echo "Port: $DB_PORT"
                    echo "User: $DB_USER"

                    echo "Running migration..."

                    node src/db/migrate.js

                    echo "Database migration completed successfully"
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

                    cd "$APP_DIR"

                    node --check src/server.js

                    echo "Application syntax OK"
                '''
            }
        }

        stage('Stop Previous PM2') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        STOPPING OLD APPLICATION"
                    echo "=========================================="

                    pm2 delete "$APP_NAME" 2>/dev/null || true

                    echo "Old PM2 process removed"
                '''
            }
        }

        stage('Start Application') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        STARTING APPLICATION"
                    echo "=========================================="

                    cd "$APP_DIR"

                    set -a
                    . ./.env
                    set +a

                    pm2 start src/server.js \
                        --name "$APP_NAME" \
                        --time

                    pm2 save

                    echo "Application started"

                    pm2 status
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

                    pm2 status "$APP_NAME"

                    if pm2 describe "$APP_NAME" | grep -q "online"; then
                        echo "PM2 application is ONLINE"
                    else
                        echo "ERROR: Application is not online"

                        pm2 logs "$APP_NAME" \
                            --lines 50 \
                            --nostream || true

                        exit 1
                    fi

                    echo "Checking application port..."

                    if ss -ltn | grep -q ":${APP_PORT} "; then
                        echo "Port $APP_PORT is listening"
                    else
                        echo "WARNING: Port $APP_PORT is not detected"
                    fi
                '''
            }
        }

        stage('Deployment Information') {
            steps {
                sh '''
                    echo ""
                    echo "=========================================="
                    echo "        DEPLOYMENT INFORMATION"
                    echo "=========================================="

                    echo "Application:"
                    echo "$APP_NAME"

                    echo "Directory:"
                    echo "$APP_DIR"

                    echo "Port:"
                    echo "$APP_PORT"

                    echo ""
                    echo "PM2 Status:"
                    pm2 status

                    echo ""
                    echo "=========================================="
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

GitHub
   |
   v
Jenkins
   |
   v
/opt/essl-monitor/current
   |
   +---- PostgreSQL
   |
   +---- PM2
   |
   +---- Node.js
   |
   v
Port 5001

==============================================
'''
        }

        failure {
            sh '''
                echo ""
                echo "=========================================="
                echo "        DEPLOYMENT FAILED"
                echo "=========================================="

                echo ""
                echo "PM2 Status:"
                pm2 status || true

                echo ""
                echo "Recent Application Logs:"
                pm2 logs "$APP_NAME" \
                    --lines 50 \
                    --nostream || true

                echo "=========================================="
            '''

            echo '''
==============================================
       eSSL ATTENDANCE MONITOR
       DEPLOYMENT FAILED
==============================================

Check the failed Jenkins stage.

==============================================
'''
        }

        always {
            echo "Jenkins deployment process completed."
        }
    }
}
