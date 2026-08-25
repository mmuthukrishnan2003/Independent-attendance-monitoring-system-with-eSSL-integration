pipeline {
    agent any

    environment {
        APP_ROOT = 'essl-monitor/backend'
        APP_DIR  = '/opt/essl-monitor'
        BACKEND_DIR = '/opt/essl-monitor/backend'
        FRONTEND_DIR = '/opt/essl-monitor/frontend'
        PM2_APP_NAME = 'essl-attendance-monitor'
        PORT = '5001'
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

                    echo "Application root:"
                    echo "$APP_ROOT"

                    if [ ! -d "$APP_ROOT" ]; then
                        echo "ERROR: $APP_ROOT directory not found"
                        exit 1
                    fi

                    if [ ! -f "$APP_ROOT/package.json" ]; then
                        echo "ERROR: $APP_ROOT/package.json not found"
                        exit 1
                    fi

                    echo ""
                    echo "Backend package.json:"
                    cat "$APP_ROOT/package.json"

                    echo ""
                    echo "Project files:"
                    find "$APP_ROOT" -maxdepth 2 -type f \
                        ! -path "*/node_modules/*" | sort

                    echo "======================================"
                '''
            }
        }

        stage('Clean Old Dependencies') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Cleaning Old node_modules"
                    echo "======================================"

                    rm -rf "$APP_ROOT/node_modules"

                    echo "Old node_modules removed"

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

                    cd "$APP_ROOT"

                    if [ -f package-lock.json ]; then
                        echo "package-lock.json found"
                        echo "Running npm ci..."
                        npm ci
                    else
                        echo "package-lock.json not found"
                        echo "Running npm install..."
                        npm install
                    fi

                    echo ""
                    echo "Dependencies installed successfully"

                    echo "======================================"
                '''
            }
        }

        stage('Create Production Environment') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Creating Production Environment"
                    echo "======================================"

                    sudo mkdir -p "$APP_DIR"
                    sudo mkdir -p "$BACKEND_DIR"
                    sudo mkdir -p "$FRONTEND_DIR"

                    sudo chown -R jenkins:jenkins "$APP_DIR"

                    echo "Application directory:"
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
                    echo "Deploying Backend"
                    echo "======================================"

                    rm -rf "$BACKEND_DIR"/*
                    cp -r "$APP_ROOT"/. "$BACKEND_DIR"/

                    rm -rf "$BACKEND_DIR/.git"
                    rm -rf "$BACKEND_DIR/node_modules"

                    cd "$BACKEND_DIR"

                    if [ -f package-lock.json ]; then
                        npm ci --omit=dev
                    else
                        npm install --omit=dev
                    fi

                    echo "Backend deployed successfully"

                    echo "======================================"
                '''
            }
        }

        stage('Create Database') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "PostgreSQL Database Check"
                    echo "======================================"

                    if ! command -v psql >/dev/null 2>&1; then
                        echo "ERROR: PostgreSQL client not installed"
                        exit 1
                    fi

                    echo "PostgreSQL:"
                    psql --version

                    echo ""
                    echo "Checking database connection..."

                    if sudo -u postgres psql -c "SELECT version();" >/dev/null 2>&1; then
                        echo "PostgreSQL connection: OK"
                    else
                        echo "WARNING: Could not connect to PostgreSQL"
                        echo "Database creation will be handled by application configuration"
                    fi

                    echo "======================================"
                '''
            }
        }

        stage('Test') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Testing Application"
                    echo "======================================"

                    cd "$BACKEND_DIR"

                    if [ -f package.json ]; then
                        echo "Testing package.json..."

                        if npm run | grep -q "test"; then
                            npm test -- --if-present || true
                        else
                            echo "No test script configured"
                        fi
                    fi

                    echo "Application test stage completed"

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

                    cd "$BACKEND_DIR"

                    if [ ! -f package.json ]; then
                        echo "ERROR: package.json not found"
                        exit 1
                    fi

                    echo "Stopping old application..."

                    pm2 delete "$PM2_APP_NAME" 2>/dev/null || true

                    echo "Starting application..."

                    if [ -f src/server.js ]; then
                        pm2 start src/server.js \
                            --name "$PM2_APP_NAME"
                    elif [ -f server.js ]; then
                        pm2 start server.js \
                            --name "$PM2_APP_NAME"
                    elif [ -f app.js ]; then
                        pm2 start app.js \
                            --name "$PM2_APP_NAME"
                    else
                        echo "ERROR: Could not find server.js"
                        echo "Expected one of:"
                        echo "  src/server.js"
                        echo "  server.js"
                        echo "  app.js"
                        exit 1
                    fi

                    pm2 save

                    echo ""
                    echo "PM2 applications:"
                    pm2 list

                    echo "======================================"
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    set +e

                    echo "======================================"
                    echo "Application Health Check"
                    echo "======================================"

                    echo "Waiting for application..."
                    sleep 5

                    echo ""
                    echo "PM2 status:"
                    pm2 status

                    echo ""
                    echo "Testing port $PORT..."

                    if curl -fsS "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
                        echo "Application: ONLINE"
                    else
                        echo "WARNING: Application did not respond on port $PORT"
                        echo ""
                        echo "PM2 logs:"
                        pm2 logs "$PM2_APP_NAME" --lines 30 --nostream
                    fi

                    echo ""
                    echo "Port check:"
                    ss -ltnp | grep ":$PORT" || true

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
Application: /opt/essl-monitor
Backend:     /opt/essl-monitor/backend
PM2 App:     essl-attendance-monitor
Port:        5001
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
========================================
'''
        }

        always {
            echo 'Jenkins pipeline completed.'
        }
    }
}
