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
        DEPLOY_USER = 'jenkins'
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

                    test -d essl-monitor/backend
                    test -f essl-monitor/backend/package.json
                    test -f essl-monitor/backend/package-lock.json
                    test -f essl-monitor/backend/src/server.js
                    test -f essl-monitor/backend/src/db/migrate.js

                    echo "Migration file found."
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

                    # Do not print database password into Jenkins logs
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

                    # Load environment without echoing secrets
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

                        echo "Creating application backup:"
                        echo "$BACKUP_NAME"

                        mkdir -p "$BACKUP_NAME"

                        cp -a "$APP_CURRENT"/. "$BACKUP_NAME"/

                        echo "Application backup created"

                    else
                        echo "No existing deployment found."
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

                    echo "Installing production dependencies..."

                    cd "$TEMP_DIR"

                    npm ci --omit=dev

                    echo "Production dependencies installed"

                    echo "Deployment directory prepared:"
                    echo "$TEMP_DIR"
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

                    TEMP_DIR="$APP_ROOT/deploy-${BUILD_NUMBER}"

                    cd "$TEMP_DIR"

                    test -f package.json
                    test -f package-lock.json
                    test -f src/server.js
                    test -f src/db/migrate.js
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

                    echo "Database:"
                    echo "  Host: $DB_HOST"
                    echo "  Port: $DB_PORT"
                    echo "  Name: $DB_NAME"
                    echo "  User: $DB_USER"

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

                    TEMP_DIR="$APP_ROOT/deploy-${BUILD_NUMBER}"

                    node --check "$TEMP_DIR/src/server.js"
                    node --check "$TEMP_DIR/src/db/migrate.js"

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

                    TEMP_DIR="$APP_ROOT/deploy-${BUILD_NUMBER}"

                    if [ ! -d "$TEMP_DIR" ]; then
                        echo "ERROR: Deployment directory not found"
                        exit 1
                    fi

                    echo "Stopping previous PM2 application..."

                    pm2 delete "$APP_NAME" 2>/dev/null || true

                    echo "Replacing current application..."

                    if [ -d "$APP_CURRENT" ]; then
                        rm -rf "$APP_ROOT/previous"
                        mv "$APP_CURRENT" "$APP_ROOT/previous"
                    fi

                    mv "$TEMP_DIR" "$APP_CURRENT"

                    echo "Application deployed to:"
                    echo "$APP_CURRENT"

                    cd "$APP_CURRENT"

                    echo "Starting application with PM2..."

                    pm2 start src/server.js \
                        --name "$APP_NAME" \
                        --cwd "$APP_CURRENT" \
                        --time \
                        --update-env

                    echo "PM2 process started"

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
                                const app = data.find(x => x.name === process.argv[1]);

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
                        pm2 logs "$APP_NAME" --lines 50 --nostream || true
                        exit 1
                    fi

                    echo ""
                    echo "Checking application port $APP_PORT..."

                    curl -fsS \
                        --connect-timeout 5 \
                        --max-time 10 \
                        "http://127.0.0.1:$APP_PORT/" \
                        > /dev/null

                    echo "Application HTTP health check PASSED"

                    echo ""
                    echo "PM2 and HTTP health checks PASSED"
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
                    echo "URL         : http://172.16.0.111:$APP_PORT"

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

Application:
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
                pm2 logs "$APP_NAME" --lines 50 --nostream || true
            '''

            echo '''
==============================================
       eSSL ATTENDANCE MONITOR
       DEPLOYMENT FAILED
==============================================
'''
        }

        always {
            sh '''
                echo ""
                echo "Jenkins deployment process completed."
            '''
        }
    }
}
