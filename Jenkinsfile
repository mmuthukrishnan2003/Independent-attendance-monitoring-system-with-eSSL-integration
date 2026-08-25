````bash
#!/bin/bash

set -e

echo "=============================================="
echo "   eSSL ATTENDANCE JENKINS AUTO SETUP"
echo "=============================================="

APP_ROOT="/opt/essl-monitor"
JENKINSFILE="/tmp/Jenkinsfile"

echo ""
echo "1. Installing required packages..."

sudo apt-get update

sudo apt-get install -y \
    git \
    curl \
    ca-certificates \
    postgresql-client

echo ""
echo "2. Checking Node.js..."

if ! command -v node >/dev/null 2>&1; then

    echo "Node.js not found. Installing Node.js 20..."

    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs

else

    echo "Node.js already installed:"
    node -v

fi

echo ""
echo "Node:"
node -v

echo "NPM:"
npm -v


echo ""
echo "3. Installing PM2..."

if ! command -v pm2 >/dev/null 2>&1; then

    sudo npm install -g pm2

else

    echo "PM2 already installed:"
    pm2 -v

fi

echo ""
echo "PM2:"
pm2 -v


echo ""
echo "4. Creating application directory..."

sudo mkdir -p "$APP_ROOT"
sudo mkdir -p "$APP_ROOT/backup"
sudo mkdir -p "$APP_ROOT/previous"

sudo chown -R jenkins:jenkins "$APP_ROOT"

echo "Application directory:"
echo "$APP_ROOT"


echo ""
echo "5. Creating .env if it does not exist..."

if [ ! -f "$APP_ROOT/.env" ]; then

    sudo tee "$APP_ROOT/.env" > /dev/null <<'ENVFILE'
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=essl_attendance
DB_USER=postgres
DB_PASSWORD=demo

PORT=5001
HOST=0.0.0.0
ENVFILE

    sudo chown jenkins:jenkins "$APP_ROOT/.env"
    sudo chmod 600 "$APP_ROOT/.env"

    echo ".env created."

else

    echo ".env already exists. Keeping existing configuration."

fi


echo ""
echo "6. Creating Jenkinsfile..."

cat > "$JENKINSFILE" <<'JENKINSFILE'
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
        APP_ROOT = '/opt/essl-monitor'
        APP_CURRENT = '/opt/essl-monitor/current'
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

                    test -d essl-monitor/backend
                    test -f essl-monitor/backend/package.json
                    test -f essl-monitor/backend/package-lock.json
                    test -f essl-monitor/backend/src/server.js
                    test -f essl-monitor/backend/src/db/migrate.js

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

                    test -d "$APP_ROOT"

                    if [ ! -f "$APP_ROOT/.env" ]; then
                        echo "ERROR: $APP_ROOT/.env not found"
                        exit 1
                    fi

                    echo ".env found"

                    set +x
                    set -a
                    . "$APP_ROOT/.env"
                    set +a
                    set -x

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
                dir('essl-monitor/backend') {
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

                    set +x
                    set -a
                    . "$APP_ROOT/.env"
                    set +a
                    set -x

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

                    mkdir -p "$APP_ROOT/backup"

                    if [ -d "$APP_CURRENT" ]; then

                        BACKUP_NAME="$APP_ROOT/backup/backup-$(date +%Y%m%d-%H%M%S)"

                        mkdir -p "$BACKUP_NAME"

                        cp -a "$APP_CURRENT"/. "$BACKUP_NAME"/

                        echo "Backup created:"
                        echo "$BACKUP_NAME"

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

                    TEMP_DIR="$APP_ROOT/deploy-${BUILD_NUMBER}"

                    rm -rf "$TEMP_DIR"

                    mkdir -p "$TEMP_DIR"

                    cp essl-monitor/backend/package.json "$TEMP_DIR/"
                    cp essl-monitor/backend/package-lock.json "$TEMP_DIR/"

                    cp -r essl-monitor/backend/src "$TEMP_DIR/"

                    cp "$APP_ROOT/.env" "$TEMP_DIR/.env"

                    cd "$TEMP_DIR"

                    echo "Installing production dependencies..."

                    npm ci --omit=dev

                    echo "Production dependencies installed."

                    echo "Deployment directory:"
                    echo "$TEMP_DIR"
                '''
            }
        }

        stage('Verify Deployment') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        VERIFYING DEPLOYMENT"
                    echo "=========================================="

                    TEMP_DIR="$APP_ROOT/deploy-${BUILD_NUMBER}"

                    test -f "$TEMP_DIR/package.json"
                    test -f "$TEMP_DIR/package-lock.json"
                    test -f "$TEMP_DIR/src/server.js"
                    test -f "$TEMP_DIR/src/db/migrate.js"
                    test -f "$TEMP_DIR/.env"

                    echo "Application files verified."

                    node --check "$TEMP_DIR/src/server.js"
                    node --check "$TEMP_DIR/src/db/migrate.js"

                    echo "Application syntax OK."
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

                    TEMP_DIR="$APP_ROOT/deploy-${BUILD_NUMBER}"

                    cd "$TEMP_DIR"

                    set +x
                    set -a
                    . "$APP_ROOT/.env"
                    set +a
                    set -x

                    export DB_HOST
                    export DB_PORT
                    export DB_NAME
                    export DB_USER
                    export DB_PASSWORD

                    export DATABASE_HOST="$DB_HOST"
                    export DATABASE_PORT="$DB_PORT"
                    export DATABASE_NAME="$DB_NAME"
                    export DATABASE_USER="$DB_USER"
                    export DATABASE_PASSWORD="$DB_PASSWORD"

                    export PGHOST="$DB_HOST"
                    export PGPORT="$DB_PORT"
                    export PGDATABASE="$DB_NAME"
                    export PGUSER="$DB_USER"
                    export PGPASSWORD="$DB_PASSWORD"

                    node src/db/migrate.js

                    echo "Database migration completed successfully."
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

                    TEMP_DIR="$APP_ROOT/deploy-${BUILD_NUMBER}"

                    test -d "$TEMP_DIR"

                    echo "Stopping previous PM2 process..."

                    pm2 delete "$APP_NAME" 2>/dev/null || true

                    echo "Removing old previous backup..."

                    rm -rf "$APP_ROOT/previous"

                    if [ -d "$APP_CURRENT" ]; then
                        mv "$APP_CURRENT" "$APP_ROOT/previous"
                    fi

                    mv "$TEMP_DIR" "$APP_CURRENT"

                    cd "$APP_CURRENT"

                    echo "Starting application..."

                    pm2 start src/server.js \
                        --name "$APP_NAME" \
                        --cwd "$APP_CURRENT" \
                        --time \
                        --update-env

                    pm2 save

                    echo ""
                    echo "Application started."

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

                    echo ""
                    echo "PM2 status:"
                    pm2 status

                    echo ""
                    echo "Checking PM2 application status..."

                    PM2_STATUS=$(pm2 jlist | node -e '
                        let input = "";

                        process.stdin.on("data", d => input += d);

                        process.stdin.on("end", () => {
                            try {
                                const data = JSON.parse(input);

                                const app = data.find(
                                    x => x.name === process.argv[1]
                                );

                                if (!app) {
                                    console.log("NOT_FOUND");
                                } else {
                                    console.log(app.pm2_env.status);
                                }

                            } catch (e) {
                                console.log("ERROR");
                            }
                        });
                    ' "$APP_NAME")

                    echo "PM2 status: $PM2_STATUS"

                    if [ "$PM2_STATUS" != "online" ]; then

                        echo ""
                        echo "ERROR: PM2 application is NOT online."

                        echo ""
                        echo "Last application logs:"

                        pm2 logs "$APP_NAME" \
                            --lines 50 \
                            --nostream || true

                        exit 1
                    fi

                    echo ""
                    echo "PM2 application is ONLINE."

                    echo ""
                    echo "Checking application port $APP_PORT..."

                    HTTP_CODE=$(curl \
                        -s \
                        -o /dev/null \
                        -w "%{http_code}" \
                        --connect-timeout 5 \
                        --max-time 10 \
                        "http://127.0.0.1:$APP_PORT/")

                    echo "HTTP response code: $HTTP_CODE"

                    case "$HTTP_CODE" in

                        2*)
                            echo "Application returned successful HTTP response."
                            ;;

                        3*)
                            echo "Application returned HTTP redirect."
                            ;;

                        4*)
                            echo "Application is responding."
                            echo "HTTP $HTTP_CODE is acceptable because the route may not exist."
                            ;;

                        5*)
                            echo "ERROR: Application returned server error."
                            echo "HTTP $HTTP_CODE"

                            pm2 logs "$APP_NAME" \
                                --lines 50 \
                                --nostream || true

                            exit 1
                            ;;

                        000)
                            echo "ERROR: Could not connect to application."

                            pm2 logs "$APP_NAME" \
                                --lines 50 \
                                --nostream || true

                            exit 1
                            ;;

                        *)
                            echo "ERROR: Unexpected HTTP response."
                            echo "$HTTP_CODE"

                            exit 1
                            ;;

                    esac

                    echo ""
                    echo "=========================================="
                    echo "        HEALTH CHECK PASSED"
                    echo "=========================================="
                '''
            }
        }

        stage('Deployment Information') {
            steps {
                sh '''
                    echo "=========================================="
                    echo "       DEPLOYMENT SUCCESSFUL"
                    echo "=========================================="

                    echo ""
                    echo "Application : $APP_NAME"
                    echo "Directory   : $APP_CURRENT"
                    echo "Port        : $APP_PORT"
                    echo "Dashboard   : http://172.16.0.111:$APP_PORT"

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

Dashboard:
http://172.16.0.111:5001
'''
        }

        failure {

            sh '''
                echo ""
                echo "=========================================="
                echo "       DEPLOYMENT FAILED"
                echo "=========================================="

                echo ""
                echo "PM2 status:"
                pm2 status || true

                echo ""
                echo "Application logs:"

                pm2 logs "$APP_NAME" \
                    --lines 50 \
                    --nostream || true
            '''

            echo '''
==============================================
       eSSL ATTENDANCE MONITOR
       DEPLOYMENT FAILED
==============================================
'''
        }

        always {
            echo "Jenkins deployment process completed."
        }
    }
}
JENKINSFILE

echo ""
echo "7. Validating Jenkinsfile..."

if grep -q '^```' "$JENKINSFILE"; then
    echo "ERROR: Markdown code fences detected."
    exit 1
fi

if ! grep -q '^pipeline {' "$JENKINSFILE"; then
    echo "ERROR: Jenkinsfile does not start correctly."
    exit 1
fi

echo "Jenkinsfile syntax header looks correct."


echo ""
echo "8. Copying Jenkinsfile to project..."

if [ -d "$HOME/Independent-attendance-monitoring-system-with-eSSL-integration" ]; then

    cp "$JENKINSFILE" \
        "$HOME/Independent-attendance-monitoring-system-with-eSSL-integration/Jenkinsfile"

    echo "Jenkinsfile copied to project."

elif [ -d "$HOME/Independent attendance monitoring system with eSSL integration" ]; then

    cp "$JENKINSFILE" \
        "$HOME/Independent attendance monitoring system with eSSL integration/Jenkinsfile"

    echo "Jenkinsfile copied to project."

else

    echo ""
    echo "Project directory was not found automatically."
    echo ""
    echo "Generated Jenkinsfile is available at:"
    echo "$JENKINSFILE"

fi


echo ""
echo "9. Preparing PM2 startup..."

sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u jenkins --hp /var/lib/jenkins 2>/dev/null || true

sudo -u jenkins pm2 save 2>/dev/null || true


echo ""
echo "=============================================="
echo "             SETUP COMPLETED"
echo "=============================================="

echo ""
echo "Node:"
node -v

echo ""
echo "NPM:"
npm -v

echo ""
echo "PM2:"
pm2 -v

echo ""
echo "Application directory:"
echo "$APP_ROOT"

echo ""
echo "Environment file:"
echo "$APP_ROOT/.env"

echo ""
echo "Generated Jenkinsfile:"
echo "$JENKINSFILE"

echo ""
echo "Dashboard URL:"
echo "http://172.16.0.111:5001"

echo ""
echo "Jenkins URL:"
echo "http://172.16.0.111:8080"

echo ""
echo "=============================================="
````
