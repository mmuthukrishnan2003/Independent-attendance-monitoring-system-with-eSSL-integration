pipeline {
    agent any

    environment {
        APP_NAME = 'essl-monitor'
        APP_DIR = '/opt/essl-monitor'
        BACKEND_DIR = '/opt/essl-monitor/backend'
        APP_PORT = '5001'
    }

    stages {

        stage('Checkout') {
            steps {
                echo '=== Checking out source code ==='
                checkout scm
            }
        }

        stage('Environment Check') {
            steps {
                sh '''
                    echo "=============================="
                    echo "Environment"
                    echo "=============================="

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

        stage('Create Application Directory') {
            steps {
                sh '''
                    mkdir -p ${APP_DIR}
                    mkdir -p ${APP_DIR}/backend
                    mkdir -p ${APP_DIR}/frontend

                    echo "Application directory:"
                    ls -ld ${APP_DIR}
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                dir('backend') {
                    sh '''
                        echo "Installing backend dependencies..."

                        if [ -f package-lock.json ]; then
                            npm ci
                        else
                            echo "package-lock.json not found."
                            echo "Running npm install..."
                            npm install
                        fi
                    '''
                }
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
                        cat > backend/.env <<EOF
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
EOF

                        chmod 600 backend/.env

                        echo "Production environment created."
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
                        export PGPASSWORD="${POSTGRES_PASSWORD}"

                        DATABASE_EXISTS=$(psql \
                            -h 172.16.0.111 \
                            -U postgres \
                            -d postgres \
                            -tAc "SELECT 1 FROM pg_database WHERE datname='essl_monitor'")

                        if [ "$DATABASE_EXISTS" = "1" ]; then
                            echo "Database essl_monitor already exists."
                        else
                            echo "Creating database essl_monitor..."

                            psql \
                                -h 172.16.0.111 \
                                -U postgres \
                                -d postgres \
                                -c "CREATE DATABASE essl_monitor"
                        fi
                    '''
                }
            }
        }

        stage('Database Migration') {
            steps {
                dir('backend') {
                    sh '''
                        echo "Running database migration..."
                        npm run migrate
                    '''
                }
            }
        }

        stage('Test') {
            steps {
                dir('backend') {
                    sh '''
                        if npm run | grep -q "test"; then
                            npm test
                        else
                            echo "No test script configured."
                        fi
                    '''
                }
            }
        }

        stage('Deploy Application') {
            steps {
                sh '''
                    echo "Deploying application..."

                    rsync -av \
                        --delete \
                        --exclude='.git' \
                        --exclude='node_modules' \
                        --exclude='.env' \
                        ./ ${APP_DIR}/

                    cd ${BACKEND_DIR}

                    if [ -f package-lock.json ]; then
                        npm ci --omit=dev
                    else
                        npm install --omit=dev
                    fi

                    echo "Application deployed."
                '''
            }
        }

        stage('Configure PM2') {
            steps {
                sh '''
                    cd ${BACKEND_DIR}

                    if pm2 describe ${APP_NAME} > /dev/null 2>&1; then
                        echo "Restarting existing application..."
                        pm2 restart ${APP_NAME}
                    else
                        echo "Starting application..."
                        pm2 start src/server.js --name ${APP_NAME}
                    fi

                    pm2 save

                    echo "PM2 status:"
                    pm2 status
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    echo "Waiting for application..."
                    sleep 5

                    curl -f http://127.0.0.1:${APP_PORT}/

                    echo ""
                    echo "======================================"
                    echo " eSSL Monitor Deployment Successful"
                    echo "======================================"
                    echo "Dashboard:"
                    echo "http://172.16.0.111:${APP_PORT}/"
                    echo "======================================"
                '''
            }
        }
    }

    post {
        success {
            echo 'eSSL Monitor deployment completed successfully.'
        }

        failure {
            echo 'Deployment failed. Check the Jenkins console log.'
        }
    }
}
