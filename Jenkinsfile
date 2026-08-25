pipeline {
    agent any

    environment {
        APP_NAME = 'essl-attendance-monitor'
        APP_DIR = '/opt/essl-monitor/current'
        ENV_FILE = '/opt/essl-monitor/.env'
        PORT = '5001'
    }

    stages {

        stage('Environment Check') {
            steps {
                sh '''
                    set -e
                    echo "======================================"
                    echo "Environment Check"
                    echo "======================================"

                    node -v
                    npm -v
                    git --version
                    psql --version
                    pm2 -v

                    echo "Environment OK"
                '''
            }
        }

        stage('Validate Project') {
            steps {
                sh '''
                    set -e

                    test -d essl-monitor/backend
                    test -f essl-monitor/backend/package.json
                    test -f essl-monitor/backend/src/server.js

                    echo "Project structure OK"
                '''
            }
        }

        stage('Check Environment') {
            steps {
                sh '''
                    set -e

                    if [ ! -f "$ENV_FILE" ]; then
                        echo "ERROR: $ENV_FILE not found"
                        exit 1
                    fi

                    set -a
                    . "$ENV_FILE"
                    set +a

                    [ -n "$DB_HOST" ] || { echo "DB_HOST missing"; exit 1; }
                    [ -n "$DB_PORT" ] || { echo "DB_PORT missing"; exit 1; }
                    [ -n "$DB_NAME" ] || { echo "DB_NAME missing"; exit 1; }
                    [ -n "$DB_USER" ] || { echo "DB_USER missing"; exit 1; }
                    [ -n "$DB_PASSWORD" ] || { echo "DB_PASSWORD missing"; exit 1; }

                    echo "Database configuration OK"
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    set -e
                    cd essl-monitor/backend
                    npm ci
                    echo "Dependencies installed"
                '''
            }
        }

        stage('Prepare Application') {
            steps {
                sh '''
                    set -e

                    rm -rf "$APP_DIR"
                    mkdir -p "$APP_DIR"

                    cp -r essl-monitor/backend/package.json "$APP_DIR/"
                    cp -r essl-monitor/backend/package-lock.json "$APP_DIR/"
                    cp -r essl-monitor/backend/src "$APP_DIR/"

                    cp "$ENV_FILE" "$APP_DIR/.env"

                    echo "Application files copied"
                '''
            }
        }

        stage('Production Dependencies') {
            steps {
                sh '''
                    set -e
                    cd "$APP_DIR"
                    npm ci --omit=dev
                    echo "Production dependencies installed"
                '''
            }
        }

        stage('Database Connection') {
            steps {
                sh '''
                    set -e

                    set -a
                    . "$ENV_FILE"
                    set +a

                    echo "Testing PostgreSQL..."

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

        stage('Database Migration') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    if [ ! -f src/db/migrate.js ]; then
                        echo "ERROR: migrate.js not found"
                        exit 1
                    fi

                    set -a
                    . "$ENV_FILE"
                    set +a

                    echo "Running database migration..."

                    npm run migrate

                    echo "Database migration successful"
                '''
            }
        }

        stage('Application Test') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    node --check src/server.js

                    if [ -f src/db/migrate.js ]; then
                        node --check src/db/migrate.js
                    fi

                    echo "Application syntax check successful"
                '''
            }
        }

        stage('Start Application') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    pm2 delete "$APP_NAME" 2>/dev/null || true

                    pm2 start src/server.js \
                        --name "$APP_NAME" \
                        --update-env

                    pm2 save

                    echo "Application started"
                    pm2 status
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    set -e

                    sleep 5

                    pm2 describe "$APP_NAME"

                    echo ""
                    echo "======================================"
                    echo "DEPLOYMENT SUCCESSFUL"
                    echo "======================================"
                    echo "Dashboard:"
                    echo "http://172.16.0.111:5001/"
                    echo "======================================"
                '''
            }
        }
    }

    post {
        success {
            echo '''
========================================
eSSL Attendance Monitor
DEPLOYMENT SUCCESS
========================================
Dashboard:
http://172.16.0.111:5001/
========================================
'''
        }

        failure {
            echo '''
========================================
eSSL Attendance Monitor
DEPLOYMENT FAILED
========================================
Check the failed stage in Console Output.
========================================
'''
        }
    }
}
