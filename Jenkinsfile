pipeline {
    agent any

    environment {
        APP_NAME = 'essl-monitor'
        APP_DIR = '/opt/essl-monitor'
        BACKEND_DIR = 'essl-monitor/backend'

        APP_PORT = '5001'

        DB_NAME = 'essl_attendance'
        DB_USER = 'essl_app'

        PM2_APP_NAME = 'essl-attendance-monitor'
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

        stage('Validate Project Structure') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Validating Project Structure"
                    echo "======================================"

                    if [ ! -d "$BACKEND_DIR" ]; then
                        echo "ERROR: Backend directory not found:"
                        echo "$BACKEND_DIR"
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

                    echo ""
                    echo "Backend package.json:"
                    cat "$BACKEND_DIR/package.json"

                    echo ""
                    echo "Backend files:"
                    find "$BACKEND_DIR" -maxdepth 3 -type f \
                        ! -path "*/node_modules/*" | sort

                    echo "======================================"
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Installing Node.js Dependencies"
                    echo "======================================"

                    cd "$BACKEND_DIR"

                    if [ -f package-lock.json ]; then
                        echo "package-lock.json found"
                        npm ci
                    else
                        echo "package-lock.json not found"
                        npm install
                    fi

                    echo ""
                    echo "Dependencies installed successfully"

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

                    # Jenkins must have permission to write to this directory.
                    # Do NOT use sudo inside Jenkins.

                    if [ ! -d "$APP_DIR" ]; then
                        echo "ERROR: $APP_DIR does not exist."
                        echo ""
                        echo "Run this ONCE on the server as an administrator:"
                        echo ""
                        echo "sudo mkdir -p $APP_DIR"
                        echo "sudo chown -R jenkins:jenkins $APP_DIR"
                        echo ""
                        exit 1
                    fi

                    echo "Production directory:"
                    ls -ld "$APP_DIR"

                    echo "======================================"
                '''
            }
        }

        stage('Deploy Backend Files') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Deploying Backend Files"
                    echo "======================================"

                    rm -rf "$APP_DIR/current"

                    mkdir -p "$APP_DIR/current"

                    cp -r "$BACKEND_DIR"/* "$APP_DIR/current/"

                    if [ -d "$BACKEND_DIR/.env" ]; then
                        cp -r "$BACKEND_DIR/.env" "$APP_DIR/current/"
                    fi

                    echo ""
                    echo "Deployed files:"
                    find "$APP_DIR/current" -maxdepth 3 -type f \
                        ! -path "*/node_modules/*" | sort

                    echo "======================================"
                '''
            }
        }

        stage('Create Database') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Checking PostgreSQL Database"
                    echo "======================================"

                    if ! systemctl is-active --quiet postgresql; then
                        echo "WARNING: PostgreSQL service is not active."
                        echo "Trying to continue..."
                    fi

                    if psql -U postgres -tAc \
                        "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" \
                        2>/dev/null | grep -q 1; then

                        echo "Database $DB_NAME already exists."

                    else
                        echo "Database $DB_NAME does not exist."

                        echo "Creating database..."

                        createdb -U postgres "$DB_NAME" 2>/dev/null || true

                        echo "Database creation completed."
                    fi

                    echo ""
                    echo "Checking database:"
                    psql -U postgres -lqt 2>/dev/null | grep "$DB_NAME" || true

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

                    cd "$APP_DIR/current"

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

        stage('Run Database Migration') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Running Database Migration"
                    echo "======================================"

                    cd "$APP_DIR/current"

                    if grep -q '"migrate"' package.json; then
                        npm run migrate || {
                            echo "WARNING: Migration failed."
                            echo "Check database configuration."
                            exit 1
                        }
                    else
                        echo "No migration script found."
                    fi

                    echo "======================================"
                '''
            }
        }

        stage('Test Application') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Testing Application"
                    echo "======================================"

                    cd "$APP_DIR/current"

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

                    cd "$APP_DIR/current"

                    pm2 delete "$PM2_APP_NAME" 2>/dev/null || true

                    pm2 start src/server.js \
                        --name "$PM2_APP_NAME"

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
                        echo "SUCCESS: Application is listening on port $APP_PORT"
                    else
                        echo "WARNING: Port $APP_PORT is not listening."
                        echo ""
                        echo "Recent PM2 logs:"
                        pm2 logs "$PM2_APP_NAME" --lines 30 --nostream
                    fi

                    echo ""
                    echo "Testing HTTP endpoint..."

                    curl -f \
                        --connect-timeout 5 \
                        --max-time 10 \
                        "http://127.0.0.1:$APP_PORT/" \
                        >/dev/null 2>&1

                    if [ $? -eq 0 ]; then
                        echo "SUCCESS: Application HTTP health check passed."
                    else
                        echo "WARNING: HTTP health check failed."
                        echo "The application may still be starting."
                    fi

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

Application:
http://172.16.0.111:5001/

PM2:
essl-attendance-monitor

Status:
DEPLOYED
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

IMPORTANT:
This pipeline does NOT use sudo.

Make sure the following was executed
ONCE by an administrator:

sudo mkdir -p /opt/essl-monitor
sudo chown -R jenkins:jenkins /opt/essl-monitor

========================================
'''
        }

        always {
            echo 'Jenkins pipeline completed.'
        }
    }
}
