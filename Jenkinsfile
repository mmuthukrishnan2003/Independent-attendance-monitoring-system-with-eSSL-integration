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

        APP_DIR = '/opt/essl-monitor'

        BACKEND_CONTAINER = 'essl-monitor-backend'
        FRONTEND_CONTAINER = 'essl-monitor-frontend'

        BACKEND_IMAGE = 'essl-monitor-backend:latest'
        FRONTEND_IMAGE = 'essl-monitor-frontend:latest'

        BACKEND_PORT = '5001'
        FRONTEND_PORT = '8081'

        BACKEND_INTERNAL_PORT = '5000'

        DOCKER_NETWORK = 'essl-monitor-network'
    }

    stages {

        stage('Environment Check') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        ENVIRONMENT CHECK"
                    echo "=========================================="

                    echo "User:"
                    whoami

                    echo ""
                    echo "Node:"
                    node -v

                    echo ""
                    echo "NPM:"
                    npm -v

                    echo ""
                    echo "Git:"
                    git --version

                    echo ""
                    echo "Docker:"
                    docker --version

                    echo ""
                    echo "Docker Compose:"
                    docker compose version

                    echo ""
                    echo "PostgreSQL:"
                    psql --version

                    echo ""
                    echo "Docker access:"
                    docker ps

                    echo ""
                    echo "Environment check completed."
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
                    test -d essl-monitor/frontend

                    test -f essl-monitor/backend/package.json
                    test -f essl-monitor/backend/package-lock.json
                    test -f essl-monitor/backend/src/server.js
                    test -f essl-monitor/backend/src/db/migrate.js

                    test -f essl-monitor/frontend/index.html
                    test -f essl-monitor/frontend/dashboard.html

                    echo ""
                    echo "Backend structure: OK"
                    echo "Frontend structure: OK"
                '''
            }
        }

        stage('Prepare Docker Files') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        PREPARING DOCKER FILES"
                    echo "=========================================="

                    mkdir -p essl-monitor/backend
                    mkdir -p essl-monitor/frontend/nginx

                    cat > essl-monitor/backend/Dockerfile <<'EOF'
FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY src ./src

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

CMD ["node", "src/server.js"]
EOF

                    cat > essl-monitor/frontend/Dockerfile <<'EOF'
FROM nginx:alpine

COPY . /usr/share/nginx/html

COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
EOF

                    cat > essl-monitor/frontend/nginx/default.conf <<'EOF'
server {

    listen 80;
    listen [::]:80;

    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://essl-monitor-backend:5000/api/;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_connect_timeout 10s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

                    echo "Backend Dockerfile created."
                    echo "Frontend Dockerfile created."
                    echo "Nginx reverse proxy created."
                '''
            }
        }

        stage('Prepare Environment') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        CHECKING APPLICATION ENV"
                    echo "=========================================="

                    if [ ! -f "$APP_DIR/.env" ]; then
                        echo "ERROR: $APP_DIR/.env not found."
                        echo ""
                        echo "Create the file first:"
                        echo "sudo nano $APP_DIR/.env"
                        exit 1
                    fi

                    echo ".env found."

                    echo ""
                    echo "Checking required variables..."

                    required_vars="
PGHOST
PGUSER
PGPASSWORD
PGDATABASE
DEVICES
JWT_SECRET
"

                    missing=0

                    while IFS= read -r var
                    do
                        [ -z "$var" ] && continue

                        if ! grep -Eq "^${var}=" "$APP_DIR/.env"; then
                            echo "ERROR: Missing $var in $APP_DIR/.env"
                            missing=1
                        fi
                    done <<EOF
$required_vars
EOF

                    if [ "$missing" -ne 0 ]; then
                        echo ""
                        echo "Required environment variables are missing."
                        exit 1
                    fi

                    echo "Required environment variables: OK"

                    echo ""
                    echo "NOTE: .env values are not printed for security."
                '''
            }
        }

        stage('Backend Dependency Test') {
            steps {
                dir('essl-monitor/backend') {
                    sh '''
                        set -eu

                        echo "=========================================="
                        echo "        BACKEND DEPENDENCY TEST"
                        echo "=========================================="

                        npm ci

                        echo ""
                        echo "Backend dependencies installed successfully."
                    '''
                }
            }
        }

        stage('Test PostgreSQL') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        TESTING POSTGRESQL"
                    echo "=========================================="

                    set -a
                    . "$APP_DIR/.env"
                    set +a

                    PGPASSWORD="$PGPASSWORD" \
                    psql \
                        -h "$PGHOST" \
                        -U "$PGUSER" \
                        -d "$PGDATABASE" \
                        -c "SELECT version();" \
                        >/tmp/essl-postgres-test.txt

                    echo "PostgreSQL connection: OK"
                '''
            }
        }

        stage('Database Migration') {
            steps {
                dir('essl-monitor/backend') {
                    sh '''
                        set -eu

                        echo "=========================================="
                        echo "        DATABASE MIGRATION"
                        echo "=========================================="

                        set -a
                        . "$APP_DIR/.env"
                        set +a

                        npm run migrate

                        echo ""
                        echo "Database migration completed."
                    '''
                }
            }
        }

        stage('Create Docker Network') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        DOCKER NETWORK"
                    echo "=========================================="

                    if docker network inspect "$DOCKER_NETWORK" >/dev/null 2>&1; then
                        echo "Docker network already exists:"
                        echo "$DOCKER_NETWORK"
                    else
                        docker network create "$DOCKER_NETWORK"
                        echo "Docker network created:"
                        echo "$DOCKER_NETWORK"
                    fi
                '''
            }
        }

        stage('Build Backend Image') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        BUILD BACKEND IMAGE"
                    echo "=========================================="

                    docker build \
                        --pull \
                        -t "$BACKEND_IMAGE" \
                        essl-monitor/backend

                    echo ""
                    echo "Backend image built successfully."
                '''
            }
        }

        stage('Build Frontend Image') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        BUILD FRONTEND IMAGE"
                    echo "=========================================="

                    docker build \
                        --pull \
                        -t "$FRONTEND_IMAGE" \
                        essl-monitor/frontend

                    echo ""
                    echo "Frontend image built successfully."
                '''
            }
        }

        stage('Stop Old Containers') {
            steps {
                sh '''
                    set +e

                    echo "=========================================="
                    echo "        STOPPING OLD CONTAINERS"
                    echo "=========================================="

                    docker rm -f "$BACKEND_CONTAINER" >/dev/null 2>&1 || true
                    docker rm -f "$FRONTEND_CONTAINER" >/dev/null 2>&1 || true

                    echo "Old containers removed."
                '''
            }
        }

        stage('Check Ports') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        CHECKING PORTS"
                    echo "=========================================="

                    echo "Checking backend port $BACKEND_PORT..."

                    if ss -ltn | grep -q ":$BACKEND_PORT "; then
                        echo "WARNING: Port $BACKEND_PORT is currently in use."
                    else
                        echo "Port $BACKEND_PORT is available."
                    fi

                    echo ""
                    echo "Checking frontend port $FRONTEND_PORT..."

                    if ss -ltn | grep -q ":$FRONTEND_PORT "; then
                        echo "WARNING: Port $FRONTEND_PORT is currently in use."
                    else
                        echo "Port $FRONTEND_PORT is available."
                    fi
                '''
            }
        }

        stage('Start Backend Container') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        STARTING BACKEND"
                    echo "=========================================="

                    docker run -d \
                        --name "$BACKEND_CONTAINER" \
                        --restart unless-stopped \
                        --network "$DOCKER_NETWORK" \
                        --env-file "$APP_DIR/.env" \
                        -p "$BACKEND_PORT:$BACKEND_INTERNAL_PORT" \
                        "$BACKEND_IMAGE"

                    echo ""
                    echo "Backend container started."
                '''
            }
        }

        stage('Start Frontend Container') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        STARTING FRONTEND"
                    echo "=========================================="

                    docker run -d \
                        --name "$FRONTEND_CONTAINER" \
                        --restart unless-stopped \
                        --network "$DOCKER_NETWORK" \
                        -p "$FRONTEND_PORT:80" \
                        "$FRONTEND_IMAGE"

                    echo ""
                    echo "Frontend container started."
                '''
            }
        }

        stage('Wait For Containers') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        WAITING FOR CONTAINERS"
                    echo "=========================================="

                    sleep 10

                    echo ""
                    echo "Container status:"

                    docker ps \
                        --filter "name=$BACKEND_CONTAINER" \
                        --filter "name=$FRONTEND_CONTAINER"
                '''
            }
        }

        stage('Backend Health Check') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        BACKEND HEALTH CHECK"
                    echo "=========================================="

                    success=0

                    for i in 1 2 3 4 5 6 7 8 9 10
                    do
                        echo "Attempt $i/10..."

                        if curl -fsS \
                            --max-time 5 \
                            "http://127.0.0.1:$BACKEND_PORT/" \
                            >/tmp/essl-backend-health.txt 2>&1; then

                            echo "Backend HTTP check: OK"
                            success=1
                            break
                        fi

                        sleep 2
                    done

                    if [ "$success" -ne 1 ]; then
                        echo ""
                        echo "Backend health check failed."
                        echo ""
                        echo "Backend logs:"
                        docker logs "$BACKEND_CONTAINER" --tail 100
                        exit 1
                    fi
                '''
            }
        }

        stage('Frontend Health Check') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        FRONTEND HEALTH CHECK"
                    echo "=========================================="

                    curl -fsS \
                        --max-time 10 \
                        "http://127.0.0.1:$FRONTEND_PORT/" \
                        >/tmp/essl-frontend-health.txt

                    echo "Frontend HTTP check: OK"
                '''
            }
        }

        stage('API Proxy Check') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        API PROXY CHECK"
                    echo "=========================================="

                    echo "Testing frontend -> backend API proxy..."

                    HTTP_CODE=$(curl \
                        -s \
                        -o /tmp/essl-api-response.txt \
                        -w "%{http_code}" \
                        --max-time 10 \
                        "http://127.0.0.1:$FRONTEND_PORT/api/attendance/today" \
                        || true)

                    echo "API HTTP status: $HTTP_CODE"

                    if [ "$HTTP_CODE" = "404" ]; then
                        echo ""
                        echo "ERROR: Frontend is not proxying /api correctly."
                        echo ""
                        echo "Frontend logs:"
                        docker logs "$FRONTEND_CONTAINER" --tail 50
                        exit 1
                    fi

                    if [ "$HTTP_CODE" = "502" ]; then
                        echo ""
                        echo "ERROR: Nginx cannot reach backend."
                        echo ""
                        echo "Backend logs:"
                        docker logs "$BACKEND_CONTAINER" --tail 100
                        exit 1
                    fi

                    echo "API proxy is responding."
                '''
            }
        }

        stage('Container Status') {
            steps {
                sh '''
                    set -eu

                    echo "=========================================="
                    echo "        CONTAINER STATUS"
                    echo "=========================================="

                    docker ps \
                        --filter "name=$BACKEND_CONTAINER" \
                        --filter "name=$FRONTEND_CONTAINER" \
                        --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"

                    echo ""
                    echo "Backend:"
                    docker inspect \
                        --format='Status={{.State.Status}} Restarting={{.State.Restarting}}' \
                        "$BACKEND_CONTAINER"

                    echo ""
                    echo "Frontend:"
                    docker inspect \
                        --format='Status={{.State.Status}} Restarting={{.State.Restarting}}' \
                        "$FRONTEND_CONTAINER"
                '''
            }
        }

        stage('Deployment Information') {
            steps {
                sh '''
                    set -eu

                    echo ""
                    echo "===================================================="
                    echo "          DEPLOYMENT SUCCESSFUL"
                    echo "===================================================="

                    echo ""
                    echo "Application:"
                    echo "eSSL Independent Attendance Monitoring System"

                    echo ""
                    echo "Server:"
                    echo "172.16.0.111"

                    echo ""
                    echo "Frontend:"
                    echo "http://172.16.0.111:$FRONTEND_PORT/"

                    echo ""
                    echo "Backend:"
                    echo "http://172.16.0.111:$BACKEND_PORT/"

                    echo ""
                    echo "API through frontend:"
                    echo "http://172.16.0.111:$FRONTEND_PORT/api/"

                    echo ""
                    echo "Backend container:"
                    echo "$BACKEND_CONTAINER"

                    echo ""
                    echo "Frontend container:"
                    echo "$FRONTEND_CONTAINER"

                    echo ""
                    echo "Docker network:"
                    echo "$DOCKER_NETWORK"

                    echo ""
                    echo "===================================================="
                '''
            }
        }
    }

    post {

        success {
            echo "Jenkins Docker deployment completed successfully."

            sh '''
                echo ""
                echo "=========================================="
                echo "        FINAL CONTAINER STATUS"
                echo "=========================================="

                docker ps \
                    --filter "name=$BACKEND_CONTAINER" \
                    --filter "name=$FRONTEND_CONTAINER"
            '''
        }

        failure {
            echo "Jenkins Docker deployment failed."

            sh '''
                set +e

                echo ""
                echo "===================================================="
                echo "        DOCKER DEPLOYMENT FAILED"
                echo "===================================================="

                echo ""
                echo "All relevant containers:"
                docker ps -a \
                    --filter "name=$BACKEND_CONTAINER" \
                    --filter "name=$FRONTEND_CONTAINER"

                echo ""
                echo "Backend logs:"
                docker logs "$BACKEND_CONTAINER" --tail 100 2>&1 || true

                echo ""
                echo "Frontend logs:"
                docker logs "$FRONTEND_CONTAINER" --tail 100 2>&1 || true

                echo ""
                echo "Docker network:"
                docker network inspect "$DOCKER_NETWORK" 2>&1 || true

                echo ""
                echo "Port $BACKEND_PORT:"
                ss -ltnp | grep ":$BACKEND_PORT " || true

                echo ""
                echo "Port $FRONTEND_PORT:"
                ss -ltnp | grep ":$FRONTEND_PORT " || true

                echo ""
                echo "===================================================="
            '''
        }

        always {
            echo "Jenkins Docker deployment process completed."
        }
    }
}
