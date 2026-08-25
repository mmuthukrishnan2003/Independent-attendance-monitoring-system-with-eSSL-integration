pipeline {

    agent any

    options {
        timestamps()
        disableConcurrentBuilds()

        buildDiscarder(
            logRotator(
                numToKeepStr: '10',
                artifactNumToKeepStr: '5'
            )
        )
    }

    environment {
        APP_NAME = 'essl-monitor'
        APP_DIR = "${WORKSPACE}/essl-monitor/backend"

        DB_HOST = '172.16.0.111'
        DB_PORT = '5432'
        DB_USER = 'postgres'
        DB_PASSWORD = 'demo'
        DB_NAME = 'essl_monitor'

        APP_PORT = '5001'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Check Node PostgreSQL') {
            steps {
                sh '''
                    set -e

                    echo "Node:"
                    node -v

                    echo "NPM:"
                    npm -v

                    echo "PostgreSQL:"
                    psql --version
                '''
            }
        }

        stage('Check Backend') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    test -f package.json
                    test -f src/server.js

                    echo "Backend:"
                    pwd

                    echo "package.json:"
                    cat package.json
                '''
            }
        }

        stage('Create Database') {
            steps {
                sh '''
                    set -e

                    echo "Testing PostgreSQL..."

                    PGPASSWORD="$DB_PASSWORD" psql \
                        -h "$DB_HOST" \
                        -p "$DB_PORT" \
                        -U "$DB_USER" \
                        -d postgres \
                        -c "SELECT version();"

                    DB_EXISTS=$(PGPASSWORD="$DB_PASSWORD" psql \
                        -h "$DB_HOST" \
                        -p "$DB_PORT" \
                        -U "$DB_USER" \
                        -d postgres \
                        -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")

                    if [ "$DB_EXISTS" = "1" ]; then
                        echo "Database $DB_NAME already exists."
                    else
                        echo "Creating database $DB_NAME..."

                        PGPASSWORD="$DB_PASSWORD" psql \
                            -h "$DB_HOST" \
                            -p "$DB_PORT" \
                            -U "$DB_USER" \
                            -d postgres \
                            -c "CREATE DATABASE $DB_NAME;"

                        echo "Database created."
                    fi
                '''
            }
        }

        stage('Configure Environment') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    cat > .env <<EOF
PGHOST=172.16.0.111
PGPORT=5432
PGUSER=postgres
PGPASSWORD=demo
PGDATABASE=essl_monitor

DEVICES=Device-1|172.16.0.4|4370,Device-2|172.16.0.44|4370,Device-3|172.16.0.5|4370,Device-4|172.16.0.20|4370

PORT=5001
NODE_ENV=production
EOF

                    echo ".env configured."
                    sed 's/PGPASSWORD=.*/PGPASSWORD=********/' .env
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    npm install
                '''
            }
        }

        stage('Database Migration') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    npm run migrate
                '''
            }
        }

        stage('Create Admin') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    npm run seed:admin -- admin demo
                '''
            }
        }

        stage('Check PM2') {
            steps {
                sh '''
                    set -e

                    if ! command -v pm2 >/dev/null 2>&1; then
                        npm install -g pm2
                    fi

                    pm2 -v
                '''
            }
        }

        stage('Stop Existing PM2 Application') {
            steps {
                sh '''
                    set +e

                    echo "Checking PM2 application..."

                    pm2 describe "$APP_NAME" >/dev/null 2>&1

                    if [ $? -eq 0 ]; then
                        echo "Existing $APP_NAME found."

                        pm2 stop "$APP_NAME"
                        pm2 delete "$APP_NAME"

                        sleep 2
                    else
                        echo "No existing $APP_NAME found."
                    fi

                    pm2 status

                    exit 0
                '''
            }
        }

        stage('Check Port 5001') {
            steps {
                sh '''
                    set -e

                    echo "Checking port $APP_PORT..."

                    if command -v ss >/dev/null 2>&1; then

                        PORT_CHECK=$(ss -ltnp 2>/dev/null | grep ":$APP_PORT " || true)

                    elif command -v netstat >/dev/null 2>&1; then

                        PORT_CHECK=$(netstat -ltnp 2>/dev/null | grep ":$APP_PORT " || true)

                    else

                        echo "Neither ss nor netstat is available."
                        exit 1

                    fi

                    if [ -n "$PORT_CHECK" ]; then

                        echo "ERROR: Port $APP_PORT is already in use."

                        echo "$PORT_CHECK"

                        echo ""
                        echo "Do NOT start another application on port $APP_PORT."
                        echo "Find and stop the existing application manually."

                        exit 1

                    else

                        echo "Port $APP_PORT is free."

                    fi
                '''
            }
        }

        stage('Start Application') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    echo "Starting $APP_NAME..."

                    pm2 start src/server.js \
                        --name "$APP_NAME" \
                        --time

                    sleep 5

                    pm2 status
                '''
            }
        }

        stage('Verify Application') {
            steps {
                sh '''
                    set -e

                    echo "Checking PM2..."

                    pm2 describe "$APP_NAME"

                    STATUS=$(pm2 jlist | node -e "
                        let data='';
                        process.stdin.on('data', d => data += d);
                        process.stdin.on('end', () => {
                            const apps = JSON.parse(data);
                            const app = apps.find(x => x.name === '${APP_NAME}');
                            console.log(app ? app.pm2_env.status : 'not-found');
                        });
                    ")

                    echo "Application status: $STATUS"

                    if [ "$STATUS" != "online" ]; then

                        echo "Application failed to start."

                        pm2 logs "$APP_NAME" \
                            --lines 100 \
                            --nostream || true

                        exit 1
                    fi

                    echo "Application is ONLINE."
                '''
            }
        }

        stage('Check Port') {
            steps {
                sh '''
                    set -e

                    echo "Checking port $APP_PORT..."

                    if ss -ltn | grep -q ":$APP_PORT "; then
                        echo "Port $APP_PORT is listening."
                    else
                        echo "ERROR: Application is not listening on port $APP_PORT."

                        pm2 logs "$APP_NAME" \
                            --lines 100 \
                            --nostream || true

                        exit 1
                    fi
                '''
            }
        }

        stage('Save PM2') {
            steps {
                sh '''
                    set -e

                    pm2 save

                    echo ""
                    echo "=========================================="
                    echo "DEPLOYMENT SUCCESS"
                    echo "=========================================="
                    echo "Application : $APP_NAME"
                    echo "Server      : 172.16.0.111"
                    echo "Port        : 5001"
                    echo "Dashboard   : http://172.16.0.111:5001/"
                    echo "Database    : $DB_NAME"
                    echo "=========================================="

                    pm2 status
                '''
            }
        }
    }

    post {

        success {
            echo '''
==========================================
eSSL Monitor Deployment SUCCESS
==========================================
Dashboard:
http://172.16.0.111:5001/
==========================================
'''
        }

        failure {
            echo '''
==========================================
eSSL Monitor Deployment FAILED
==========================================
'''

            sh '''
                echo "PM2:"
                pm2 status || true

                echo ""
                echo "Application logs:"
                pm2 logs essl-monitor \
                    --lines 50 \
                    --nostream || true
            '''
        }

        always {
            echo "Jenkins build completed."
        }
    }
}
