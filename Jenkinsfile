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

        NODE_ENV = 'production'
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
                    echo "Node.js"
                    echo "======================================"
                    node -v

                    echo "======================================"
                    echo "NPM"
                    echo "======================================"
                    npm -v

                    echo "======================================"
                    echo "PostgreSQL"
                    echo "======================================"
                    psql --version
                '''
            }
        }

        stage('Check Backend') {
            steps {
                sh '''
                    set -e

                    echo "Backend directory:"
                    echo "$APP_DIR"

                    if [ ! -d "$APP_DIR" ]; then
                        echo "ERROR: Backend directory does not exist."
                        exit 1
                    fi

                    cd "$APP_DIR"

                    echo "Backend files:"
                    ls -la

                    if [ ! -f package.json ]; then
                        echo "ERROR: package.json not found."
                        exit 1
                    fi

                    if [ ! -f src/server.js ]; then
                        echo "ERROR: src/server.js not found."
                        exit 1
                    fi
                '''
            }
        }

        stage('PostgreSQL Connection') {
            steps {
                sh '''
                    set -e

                    echo "Testing PostgreSQL connection..."

                    PGPASSWORD="$DB_PASSWORD" psql \
                        -h "$DB_HOST" \
                        -p "$DB_PORT" \
                        -U "$DB_USER" \
                        -d postgres \
                        -c "SELECT version();"

                    echo "PostgreSQL connection successful."
                '''
            }
        }

        stage('Create Database') {
            steps {
                sh '''
                    set -e

                    echo "Checking database: $DB_NAME"

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

                        echo "Database created successfully."

                    fi

                    echo "Testing database..."

                    PGPASSWORD="$DB_PASSWORD" psql \
                        -h "$DB_HOST" \
                        -p "$DB_PORT" \
                        -U "$DB_USER" \
                        -d "$DB_NAME" \
                        -c "SELECT current_database();"
                '''
            }
        }

        stage('Configure Environment') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    echo "Creating .env..."

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

                    echo "Environment configured."

                    sed 's/PGPASSWORD=.*/PGPASSWORD=********/' .env
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    echo "Installing dependencies..."

                    npm install

                    echo "Dependencies installed."
                '''
            }
        }

        stage('Database Migration') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    echo "Running migration..."

                    npm run migrate

                    echo "Migration completed."
                '''
            }
        }

        stage('Create Admin') {
            steps {
                sh '''
                    set -e

                    cd "$APP_DIR"

                    echo "Creating admin user..."

                    npm run seed:admin -- admin demo

                    echo "Admin user ready."
                '''
            }
        }

        stage('Install PM2') {
            steps {
                sh '''
                    set -e

                    if command -v pm2 >/dev/null 2>&1; then
                        echo "PM2 already installed."
                    else
                        echo "Installing PM2..."
                        npm install -g pm2
                    fi

                    pm2 -v
                '''
            }
        }

        stage('Stop Existing Port 5001 Process') {
            steps {
                sh '''
                    set +e

                    echo "======================================"
                    echo "Checking port $APP_PORT"
                    echo "======================================"

                    PIDS=$(sudo -n lsof -t -i:$APP_PORT 2>/dev/null)

                    if [ -n "$PIDS" ]; then

                        echo "Processes using port $APP_PORT:"
                        sudo -n lsof -i:$APP_PORT

                        echo "Stopping processes..."

                        for PID in $PIDS
                        do
                            echo "Stopping PID: $PID"
                            sudo -n kill -TERM "$PID"
                        done

                        sleep 3

                        REMAINING=$(sudo -n lsof -t -i:$APP_PORT 2>/dev/null)

                        if [ -n "$REMAINING" ]; then

                            echo "Port still occupied."

                            for PID in $REMAINING
                            do
                                echo "Force killing PID: $PID"
                                sudo -n kill -9 "$PID"
                            done

                        fi

                    else

                        echo "Port $APP_PORT is free."

                    fi

                    echo "Removing old Jenkins PM2 application..."

                    pm2 delete "$APP_NAME" 2>/dev/null || true

                    sleep 2

                    echo "Final port check:"

                    sudo -n lsof -i:$APP_PORT || true

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

                    sleep 3

                    echo "PM2 status:"

                    pm2 status

                    echo "Checking process..."

                    pm2 describe "$APP_NAME"

                    pm2 save
                '''
            }
        }

        stage('Application Health Check') {
            steps {
                sh '''
                    set -e

                    echo "Waiting for application..."

                    sleep 5

                    echo "======================================"
                    echo "Checking port $APP_PORT"
                    echo "======================================"

                    if sudo -n lsof -i:$APP_PORT >/dev/null 2>&1; then
                        echo "Port $APP_PORT is listening."
                    else
                        echo "ERROR: Port $APP_PORT is NOT listening."

                        pm2 status
                        pm2 logs "$APP_NAME" --lines 100 --nostream || true

                        exit 1
                    fi

                    echo "======================================"
                    echo "Checking PM2 status"
                    echo "======================================"

                    STATUS=$(pm2 jlist | node -e "
                        let data='';
                        process.stdin.on('data',d=>data+=d);
                        process.stdin.on('end',()=>{
                            try {
                                const apps=JSON.parse(data);
                                const app=apps.find(x=>x.name==='${APP_NAME}');
                                console.log(app ? app.pm2_env.status : 'not-found');
                            } catch(e) {
                                console.log('unknown');
                            }
                        });
                    ")

                    echo "Application status: $STATUS"

                    if [ "$STATUS" != "online" ]; then

                        echo "ERROR: $APP_NAME is not online."

                        pm2 status
                        pm2 logs "$APP_NAME" --lines 100 --nostream || true

                        exit 1
                    fi

                    echo "======================================"
                    echo "Application is ONLINE"
                    echo "======================================"

                    pm2 status
                '''
            }
        }

        stage('Final Verification') {
            steps {
                sh '''
                    set -e

                    echo ""
                    echo "=============================================="
                    echo "       eSSL MONITOR DEPLOYMENT SUCCESS"
                    echo "=============================================="
                    echo ""
                    echo "Server       : 172.16.0.111"
                    echo "Application  : $APP_NAME"
                    echo "Port         : $APP_PORT"
                    echo "Database     : $DB_NAME"
                    echo ""
                    echo "Dashboard:"
                    echo "http://172.16.0.111:5001/"
                    echo ""
                    echo "PM2:"
                    pm2 status
                    echo ""
                    echo "=============================================="
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
                echo "Final PM2 status:"
                pm2 status || true

                echo ""
                echo "Port 5001:"
                sudo -n lsof -i:5001 || true

                echo ""
                echo "Application logs:"
                pm2 logs essl-monitor --lines 50 --nostream || true
            '''
        }

        always {
            echo "Jenkins build completed."
        }
    }
}
