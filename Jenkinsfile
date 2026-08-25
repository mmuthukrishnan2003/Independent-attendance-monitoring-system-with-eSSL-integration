pipeline {
    agent any

    environment {
        APP_NAME = 'essl-monitor'
        APP_DIR = '/opt/essl-monitor'
        BACKEND_DIR = 'essl-monitor/backend'
        CURRENT_DIR = '/opt/essl-monitor/current'

        APP_PORT = '5001'
        PM2_APP_NAME = 'essl-attendance-monitor'

        DB_NAME = 'essl_attendance'
        DB_USER = 'essl_app'
        DB_HOST = '127.0.0.1'
        DB_PORT = '5432'
    }

    stages {

        stage('Checkout') {
            steps {
                echo '======================================'
                echo 'Checking out GitHub repository'
                echo '======================================'

                checkout scm
            }
        }

        stage('Environment Check') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Environment Check"
                    echo "======================================"

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

                    echo "======================================"
                '''
            }
        }

        stage('Validate Project') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Validating Project"
                    echo "======================================"

                    if [ ! -d "$BACKEND_DIR" ]; then
                        echo "ERROR: $BACKEND_DIR not found"
                        exit 1
                    fi

                    if [ ! -f "$BACKEND_DIR/package.json" ]; then
                        echo "ERROR: package.json not found"
                        exit 1
                    fi

                    if [ ! -f "$BACKEND_DIR/src/server.js" ]; then
                        echo "ERROR: src/server.js not found"
                        exit 1
                    fi

                    if [ ! -f "$BACKEND_DIR/src/db/migrate.js" ]; then
                        echo "ERROR: src/db/migrate.js not found"
                        exit 1
                    fi

                    echo "Project structure OK"

                    echo "======================================"
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Installing Dependencies"
                    echo "======================================"

                    cd "$BACKEND_DIR"

                    if [ -f package-lock.json ]; then
                        npm ci
                    else
                        npm install
                    fi

                    echo "Dependencies installed successfully."

                    echo "======================================"
                '''
            }
        }

        stage('Prepare Production Directory') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Preparing Production Directory"
                    echo "======================================"

                    if [ ! -d "$APP_DIR" ]; then
                        echo "ERROR: $APP_DIR does not exist."
                        echo ""
                        echo "Run once on Ubuntu:"
                        echo "sudo mkdir -p $APP_DIR"
                        echo "sudo chown -R jenkins:jenkins $APP_DIR"
                        exit 1
                    fi

                    echo "Production directory exists:"
                    ls -ld "$APP_DIR"

                    echo "======================================"
                '''
            }
        }

        stage('Check Database Configuration') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Checking Database Configuration"
                    echo "======================================"

                    ENV_FILE="$APP_DIR/.env"

                    if [ ! -f "$ENV_FILE" ]; then
                        echo ""
                        echo "ERROR: Production .env file not found."
                        echo ""
                        echo "Expected:"
                        echo "$ENV_FILE"
                        echo ""
                        echo "Create it ONCE on the server with:"
                        echo ""
                        echo "sudo nano $ENV_FILE"
                        echo ""
                        echo "Required values:"
                        echo ""
                        echo "DB_HOST=127.0.0.1"
                        echo "DB_PORT=5432"
                        echo "DB_NAME=essl_attendance"
                        echo "DB_USER=essl_app"
                        echo "DB_PASSWORD=YOUR_POSTGRES_PASSWORD"
                        echo ""
                        exit 1
                    fi

                    echo ".env file found."

                    # Do not print DB_PASSWORD.
                    if grep -q '^DB_HOST=' "$ENV_FILE"; then
                        echo "DB_HOST configured"
                    else
                        echo "WARNING: DB_HOST missing"
                    fi

                    if grep -q '^DB_PORT=' "$ENV_FILE"; then
                        echo "DB_PORT configured"
                    else
                        echo "WARNING: DB_PORT missing"
                    fi

                    if grep -q '^DB_NAME=' "$ENV_FILE"; then
                        echo "DB_NAME configured"
                    else
                        echo "WARNING: DB_NAME missing"
                    fi

                    if grep -q '^DB_USER=' "$ENV_FILE"; then
                        echo "DB_USER configured"
                    else
                        echo "WARNING: DB_USER missing"
                    fi

                    if grep -q '^DB_PASSWORD=' "$ENV_FILE"; then
                        echo "DB_PASSWORD configured"
                    else
                        echo "ERROR: DB_PASSWORD missing"
                        exit 1
                    fi

                    echo "Database configuration check completed."

                    echo "======================================"
                '''
            }
        }

        stage('Deploy Backend') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Deploying Backend"
                    echo "======================================"

                    rm -rf "$CURRENT_DIR"

                    mkdir -p "$CURRENT_DIR"

                    cp -r "$BACKEND_DIR"/* "$CURRENT_DIR"/

                    # Copy production environment file.
                    cp "$APP_DIR/.env" "$CURRENT_DIR/.env"

                    echo "Backend deployed."

                    echo "======================================"
                '''
            }
        }

        stage('Install Production Dependencies') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Installing Production Dependencies"
                    echo "======================================"

                    cd "$CURRENT_DIR"

                    if [ -f package-lock.json ]; then
                        npm ci --omit=dev
                    else
                        npm install --omit=dev
                    fi

                    echo "Production dependencies installed."

                    echo "======================================"
                '''
            }
        }

        stage('Test Database Connection') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Testing PostgreSQL Connection"
                    echo "======================================"

                    cd "$CURRENT_DIR"

                    # Load .env variables into this shell.
                    set -a
                    . "$APP_DIR/.env"
                    set +a

                    echo "Database:"
                    echo "${DB_NAME:-NOT_SET}"

                    echo "Host:"
                    echo "${DB_HOST:-NOT_SET}"

                    echo "Port:"
                    echo "${DB_PORT:-NOT_SET}"

                    echo "User:"
                    echo "${DB_USER:-NOT_SET}"

                    if [ -z "$DB_PASSWORD" ]; then
                        echo "ERROR: DB_PASSWORD is empty."
                        exit 1
                    fi

                    PGPASSWORD="$DB_PASSWORD" psql \
                        -h "${DB_HOST:-127.0.0.1}" \
                        -p "${DB_PORT:-5432}" \
                        -U "$DB_USER" \
                        -d "$DB_NAME" \
                        -c "SELECT current_database(), current_user;" 

                    echo ""
                    echo "PostgreSQL connection successful."

                    echo "======================================"
                '''
            }
        }

        stage('Run Database Migration') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Running Database Migration"
                    echo "======================================"

                    cd "$CURRENT_DIR"

                    # Load production environment variables.
                    set -a
                    . "$APP_DIR/.env"
                    set +a

                    echo "Running migration..."

                    npm run migrate

                    echo ""
                    echo "Database migration completed successfully."

                    echo "======================================"
                '''
            }
        }

        stage('Test Application Syntax') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Testing Node.js Application"
                    echo "======================================"

                    cd "$CURRENT_DIR"

                    node --check src/server.js

                    echo "Node.js syntax check passed."

                    echo "======================================"
                '''
            }
        }

        stage('Configure PM2') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Configuring PM2"
                    echo "======================================"

                    cd "$CURRENT_DIR"

                    pm2 delete "$PM2_APP_NAME" 2>/dev/null || true

                    pm2 start src/server.js \
                        --name "$PM2_APP_NAME" \
                        --update-env

                    pm2 save

                    echo ""
                    echo "PM2 status:"
                    pm2 status

                    echo "======================================"
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    set +e

                    echo "======================================"
                    echo "Health Check"
                    echo "======================================"

                    sleep 5

                    echo "PM2 status:"
                    pm2 status

                    echo ""
                    echo "Checking port $APP_PORT..."

                    if ss -ltn | grep -q ":$APP_PORT "; then
                        echo "SUCCESS: Port $APP_PORT is listening."
                    else
                        echo "WARNING: Port $APP_PORT is not listening."
                    fi

                    echo ""
                    echo "Testing HTTP endpoint..."

                    HTTP_CODE=$(curl \
                        -s \
                        -o /dev/null \
                        -w "%{http_code}" \
                        --connect-timeout 5 \
                        --max-time 10 \
                        "http://127.0.0.1:$APP_PORT/")

                    echo "HTTP Status: $HTTP_CODE"

                    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 500 ]; then
                        echo "SUCCESS: Application is responding."
                    else
                        echo "WARNING: Application health check returned HTTP $HTTP_CODE"
                    fi

                    echo ""
                    echo "Recent PM2 logs:"
                    pm2 logs "$PM2_APP_NAME" --lines 20 --nostream

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
 Deployment SUCCESS
========================================

Dashboard:
http://172.16.0.111:5001/

PM2:
essl-attendance-monitor

Database:
essl_attendance

Status:
DEPLOYED SUCCESSFULLY
========================================
'''
        }

        failure {
            echo '''
========================================
 eSSL Attendance Monitor
 Deployment FAILED
========================================

Check the failed Jenkins stage.

Most common causes:
1. Missing /opt/essl-monitor/.env
2. Incorrect PostgreSQL password
3. PostgreSQL user does not exist
4. Database does not exist
5. Migration error
6. Application port 5001 already in use

========================================
'''
        }

        always {
            echo 'Jenkins pipeline completed.'
        }
    }
}
