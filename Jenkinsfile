pipeline {
    agent any

    environment {
        APP_NAME = 'essl-monitor'
        APP_DIR = '/opt/essl-monitor'
        APP_PORT = '5001'

        PGHOST = '172.16.0.111'
        PGUSER = 'postgres'
        PGDATABASE = 'essl_monitor'
        PGPORT = '5432'
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

        stage('Detect Project Structure') {
            steps {
                sh '''
                    echo "======================================"
                    echo "Detecting Node.js Application"
                    echo "======================================"

                    PACKAGE_FILE=$(find . -maxdepth 5 -type f -name "package.json" | head -n 1)

                    if [ -z "$PACKAGE_FILE" ]; then
                        echo "ERROR: package.json was not found."
                        echo ""
                        echo "Repository files:"
                        find . -maxdepth 5 -type f | sort
                        exit 1
                    fi

                    APP_ROOT=$(dirname "$PACKAGE_FILE")

                    echo "package.json:"
                    echo "$PACKAGE_FILE"

                    echo "Application root:"
                    echo "$APP_ROOT"

                    echo "$APP_ROOT" > .app-root

                    echo "======================================"
                '''
            }
        }

        stage('Create Application Directory') {
            steps {
                sh '''
                    echo "======================================"
                    echo "Creating Application Directory"
                    echo "======================================"

                    mkdir -p "${APP_DIR}"
                    mkdir -p "${APP_DIR}/backend"
                    mkdir -p "${APP_DIR}/frontend"

                    echo "Application directory:"
                    ls -ld "${APP_DIR}"
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    echo "======================================"
                    echo "Installing Node.js Dependencies"
                    echo "======================================"

                    APP_ROOT=$(cat .app-root)

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

                    echo "Dependencies installed successfully."
                '''
            }
        }

        stage('Create Production Environment') {
            steps {
                withCredentials([
                    string(
                        credentialsId: 'essl-postgres-password',
                        variable: 'POSTGRES_PASSWORD'
                    ),
                    string(
                        credentialsId: 'essl-jwt-secret',
                        variable: 'JWT_SECRET'
                    )
                ]) {
                    sh '''
                        echo "======================================"
                        echo "Creating Production Environment"
                        echo "======================================"

                        APP_ROOT=$(cat .app-root)

                        cat > "$APP_ROOT/.env" <<EOF
PGHOST=172.16.0.111
PGUSER=postgres
PGPASSWORD=${POSTGRES_PASSWORD}
PGDATABASE=essl_monitor
PGPORT=5432

DEVICES=Device-1|172.16.0.4|4370,Device-2|172.16.0.44|4370,Device-3|172.16.0.5|4370,Device-4|172.16.0.20|4370

PORT=5000
NODE_ENV=production

JWT_SECRET=${JWT_SECRET}

OFFICE_START_TIME=09:00
LATE_GRACE_MINUTES=10

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM=
DAILY_REPORT_RECIPIENTS=
EOF

                        chmod 600 "$APP_ROOT/.env"

                        echo ".env created successfully."
                    '''
                }
            }
        }

        stage('Create Database') {
            steps {
                withCredentials([
                    string(
                        credentialsId: 'essl-postgres-password',
                        variable: 'POSTGRES_PASSWORD'
                    )
                ]) {
                    sh '''
                        echo "======================================"
                        echo "Checking PostgreSQL Database"
                        echo "======================================"

                        export PGPASSWORD="${POSTGRES_PASSWORD}"

                        DATABASE_EXISTS=$(psql \
                            -h "${PGHOST}" \
                            -U "${PGUSER}" \
                            -d postgres \
                            -tAc "SELECT 1 FROM pg_database WHERE datname='${PGDATABASE}'")

                        if [ "$DATABASE_EXISTS" = "1" ]; then
                            echo "Database ${PGDATABASE} already exists."
                        else
                            echo "Creating database ${PGDATABASE}..."

                            psql \
                                -h "${PGHOST}" \
                                -U "${PGUSER}" \
                                -d postgres \
                                -c "CREATE DATABASE ${PGDATABASE}"

                            echo "Database created successfully."
                        fi
                    '''
                }
            }
        }

        stage('Database Migration') {
            steps {
                sh '''
                    echo "======================================"
                    echo "Database Migration"
                    echo "======================================"

                    APP_ROOT=$(cat .app-root)

                    cd "$APP_ROOT"

                    if npm run | grep -q "migrate"; then
                        echo "Migration script found."
                        npm run migrate
                    else
                        echo "No migration script found."
                        echo "Skipping migration."
                    fi
                '''
            }
        }

        stage('Test') {
            steps {
                sh '''
                    echo "======================================"
                    echo "Application Test"
                    echo "======================================"

                    APP_ROOT=$(cat .app-root)

                    cd "$APP_ROOT"

                    if npm run | grep -q "test"; then
                        echo "Test script found."
                        npm test
                    else
                        echo "No test script configured."
                        echo "Skipping tests."
                    fi
                '''
            }
        }

        stage('Deploy Application') {
            steps {
                sh '''
                    echo "======================================"
                    echo "Deploying Application"
                    echo "======================================"

                    APP_ROOT=$(cat .app-root)

                    echo "Source:"
                    echo "$APP_ROOT"

                    echo "Destination:"
                    echo "$APP_DIR"

                    rsync -av \
                        --delete \
                        --exclude='.git' \
                        --exclude='node_modules' \
                        --exclude='.env' \
                        "$APP_ROOT/" \
                        "$APP_DIR/"

                    cp "$APP_ROOT/.env" "$APP_DIR/.env"

                    cd "$APP_DIR"

                    if [ -f package-lock.json ]; then
                        npm ci --omit=dev
                    else
                        npm install --omit=dev
                    fi

                    chmod 600 "$APP_DIR/.env"

                    echo "Application deployed successfully."
                '''
            }
        }

        stage('Configure PM2') {
            steps {
                sh '''
                    echo "======================================"
                    echo "Configuring PM2"
                    echo "======================================"

                    cd "$APP_DIR"

                    if pm2 describe "$APP_NAME" > /dev/null 2>&1; then

                        echo "Application already exists in PM2."
                        echo "Restarting application..."

                        pm2 restart "$APP_NAME"

                    else

                        echo "Starting application with PM2..."

                        pm2 start src/server.js \
                            --name "$APP_NAME"

                    fi

                    pm2 save

                    echo ""
                    echo "PM2 Status:"
                    pm2 status
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    echo "======================================"
                    echo "Application Health Check"
                    echo "======================================"

                    sleep 5

                    echo "Checking:"
                    echo "http://127.0.0.1:${APP_PORT}/"

                    curl -f "http://127.0.0.1:${APP_PORT}/"

                    echo ""
                    echo "======================================"
                    echo "DEPLOYMENT SUCCESSFUL"
                    echo "======================================"
                    echo ""
                    echo "Dashboard:"
                    echo "http://172.16.0.111:${APP_PORT}/"
                    echo ""
                    echo "Application:"
                    echo "$APP_NAME"
                    echo ""
                    echo "PM2:"
                    pm2 status
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
 Deployment Successful
========================================
Dashboard:
http://172.16.0.111:5000/
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
    }
}
