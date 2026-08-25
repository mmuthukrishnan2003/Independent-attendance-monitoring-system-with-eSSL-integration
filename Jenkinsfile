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

                        echo "Installing dependencies..."

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

                    TEMP_DIR="$APP_ROOT/deploy-${BUILD_NUMBER}"

                    rm -rf "$TEMP_DIR"
                    mkdir -p "$TEMP_DIR"

                    cp essl-monitor/backend/package.json "$TEMP_DIR/"
                    cp essl-monitor/backend/package-lock.json "$TEMP_DIR/"
                    cp -r essl-monitor/backend/src "$TEMP_DIR/"
                    cp "$APP_ROOT/.env" "$TEMP_DIR/.env"

                    cd "$TEMP_DIR"

                    npm ci --omit=dev

                    echo "Deployment directory prepared:"
                    echo "$TEMP_DIR"
                '''
            }
        }

        stage('Verify Deployment') {
            steps {
                sh '''
                    set -eu

                    TEMP_DIR="$APP_ROOT/deploy-${BUILD_NUMBER}"

                    test -f "$TEMP_DIR/package.json"
                    test -f "$TEMP_DIR/package-lock.json"
                    test -f "$TEMP_DIR/src/server.js"
                    test -f "$TEMP_DIR/src/db/migrate.js"
                    test -f "$TEMP_DIR/.env"

                    node --check "$TEMP_DIR/src/server.js"
                    node --check "$TEMP_DIR/src/db/migrate.js"

                    echo "Application syntax OK"
                '''
            }
        }

        stage('Database Migration') {
            steps {
                sh '''
                    set -eu

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

                    TEMP_DIR="$APP_ROOT/deploy-${BUILD_NUMBER}"

                    test -d "$TEMP_DIR"

                    pm2 delete "$APP_NAME" 2>/dev/null || true

                    if [ -d "$APP_CURRENT" ]; then
                        rm -rf "$APP_ROOT/previous"
                        mv "$APP_CURRENT" "$APP_ROOT/previous"
                    fi

                    mv "$TEMP_DIR" "$APP_CURRENT"

                    cd "$APP_CURRENT"

                    pm2 start src/server.js \
                        --name "$APP_NAME" \
                        --cwd "$APP_CURRENT" \
                        --time \
                        --update-env

                    pm2 save

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

                    pm2 status

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
                        echo "ERROR: PM2 application is NOT online."

                        pm2 logs "$APP_NAME" \
                            --lines 50 \
                            --nostream || true

                        exit 1
                    fi

                    echo "PM2 application is ONLINE."

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
                            echo "HTTP success."
                            ;;
                        3*)
                            echo "HTTP redirect."
                            ;;
                        4*)
                            echo "Application is responding."
                            echo "HTTP $HTTP_CODE accepted."
                            ;;
                        5*)
                            echo "ERROR: Server returned HTTP $HTTP_CODE"

                            pm2 logs "$APP_NAME" \
                                --lines 50 \
                                --nostream || true

                            exit 1
                            ;;
                        000)
                            echo "ERROR: Application is not reachable."

                            pm2 logs "$APP_NAME" \
                                --lines 50 \
                                --nostream || true

                            exit 1
                            ;;
                        *)
                            echo "ERROR: Unexpected HTTP code $HTTP_CODE"
                            exit 1
                            ;;
                    esac

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
                echo "=========================================="
                echo "       DEPLOYMENT FAILED"
                echo "=========================================="

                pm2 status || true

                pm2 logs "$APP_NAME" \
                    --lines 50 \
                    --nostream || true
            '''
        }

        always {
            echo "Jenkins deployment process completed."
        }
    }
}
