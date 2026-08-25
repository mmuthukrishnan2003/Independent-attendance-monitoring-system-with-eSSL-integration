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
        DB_USER = 'postgres'
        DB_PASSWORD = 'demo'
        DB_NAME = 'essl_monitor'

        APP_PORT = '5001'
    }

    stages {

        stage('Checkout') {
            steps {
                echo 'Checking out source code...'
                checkout scm
            }
        }

        stage('Check Node and PostgreSQL') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Node.js Version"
                    echo "======================================"
                    node -v

                    echo "======================================"
                    echo "NPM Version"
                    echo "======================================"
                    npm -v

                    echo "======================================"
                    echo "PostgreSQL Version"
                    echo "======================================"
                    psql --version

                    echo "======================================"
                    echo "Project Directory"
                    echo "======================================"
                    pwd
                    ls -la
                '''
            }
        }

        stage('Check Backend') {
            steps {
                sh '''
                    set -e

                    if [ ! -d "$APP_DIR" ]; then
                        echo "ERROR: Backend directory not found:"
                        echo "$APP_DIR"
                        exit 1
                    fi

                    cd "$APP_DIR"

                    echo "Backend directory:"
                    pwd

                    echo "Backend files:"
                    ls -la
                '''
            }
        }

        stage('Create PostgreSQL Database') {
            steps {
                sh '''
                    set -e

                    echo "Checking PostgreSQL connection..."

                    PGPASSWORD="$DB_PASSWORD" psql \
                        -h "$DB_HOST" \
                        -U "$DB_USER" \
                        -d postgres \
                        -c "SELECT version();"

                    echo "Checking database $DB_NAME..."

                    DB_EXISTS=$(PGPASSWORD="$DB_PASSWORD" psql \
                        -h "$DB_HOST" \
                        -U "$DB_USER" \
                        -d postgres \
                        -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")

                    if [ "$DB_EXISTS" = "1" ]; then
                        echo "Database $DB_NAME already exists."
                    else
                        echo "Creating database $DB_NAME..."

                        PGPASSWORD="$DB_PASSWORD" psql \
                            -h "$DB_HOST" \
                            -U "$DB_USER" \
                            -d postgres \
                            -c "CREATE DATABASE $DB_NAME;"

                        echo "Database $DB_NAME created successfully."
                    fi

                    echo "Testing new database..."

                    PGPASSWORD="$DB_PASSWORD" psql \
                        -h "$DB_HOST" \
                        -U "$DB_USER" \
                        -d "$DB_NAME" \
                        -c "SELECT current_database();"
                '''
            }
        }

        stage('Create .env') {
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

                    echo ".env configured:"
                    sed 's/PGPASSWORD=.*/PGPASSWORD=********/' .env
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    echo "Installing npm dependencies..."

                    npm install

                    echo "npm install completed."
                '''
            }
        }

        stage('Run Database Migration') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    echo "Running database migration..."

                    npm run migrate

                    echo "Migration completed successfully."
                '''
            }
        }

        stage('Create Admin User') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    echo "Creating/updating admin user..."

                    npm run seed:admin -- admin demo

                    echo "Admin setup completed."
                '''
            }
        }

        stage('Install PM2') {
            steps {
                sh '''
                    set -e

                    if ! command -v pm2 >/dev/null 2>&1; then
                        echo "PM2 not found. Installing PM2..."

                        npm install -g pm2
                    else
                        echo "PM2 already installed."
                    fi

                    pm2 -v
                '''
            }
        }

        stage('Stop Existing Application') {
            steps {
                sh '''
                    set +e

                    echo "Checking existing PM2 application..."

                    pm2 describe "$APP_NAME" >/dev/null 2>&1

                    if [ $? -eq 0 ]; then
                        echo "Stopping existing $APP_NAME..."

                        pm2 stop "$APP_NAME"
                        pm2 delete "$APP_NAME"
                    else
                        echo "No existing $APP_NAME process found."
                    fi

                    exit 0
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

                    pm2 save

                    echo "PM2 process started."

                    pm2 status
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    set -e

                    echo "Waiting for application to start..."

                    sleep 5

                    echo "Checking port $APP_PORT..."

                    if ss -ltn | grep -q ":$APP_PORT "; then
                        echo "Port $APP_PORT is listening."
                    else
                        echo "ERROR: Port $APP_PORT is not listening."
                        pm2 logs "$APP_NAME" --lines 50 --nostream || true
                        exit 1
                    fi

                    echo "Checking application..."

                    curl -f "http://127.0.0.1:$APP_PORT/" || {
                        echo "Application health check failed."
                        pm2 logs "$APP_NAME" --lines 50 --nostream || true
                        exit 1
                    }

                    echo "======================================"
                    echo "Deployment successful"
                    echo "Dashboard: http://172.16.0.111:$APP_PORT/"
                    echo "======================================"
                '''
            }
        }
    }

    post {
        success {
            echo '======================================'
            echo 'eSSL Monitor deployment SUCCESS'
            echo 'Dashboard: http://172.16.0.111:5001/'
            echo '======================================'
        }

        failure {
            echo '======================================'
            echo 'eSSL Monitor deployment FAILED'
            echo 'Check the Jenkins console output.'
            echo '======================================'

            sh '''
                pm2 status || true
                pm2 logs "$APP_NAME" --lines 50 --nostream || true
            '''
        }

        always {
            echo "Jenkins build completed."
        }
    }
}
