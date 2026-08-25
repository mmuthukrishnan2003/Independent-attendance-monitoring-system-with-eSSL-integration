pipeline {

    agent any

    environment {
        APP_ROOT = "/opt/essl-monitor"
        APP_DIR  = "/opt/essl-monitor/current"
        ENV_FILE = "/opt/essl-monitor/.env"
        PORT     = "5001"
    }

    stages {

        // =====================================================
        // CHECKOUT
        // =====================================================

        stage('Checkout') {
            steps {
                echo '======================================'
                echo 'Checking out GitHub repository'
                echo '======================================'

                checkout scm
            }
        }


        // =====================================================
        // ENVIRONMENT CHECK
        // =====================================================

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


        // =====================================================
        // VALIDATE PROJECT
        // =====================================================

        stage('Validate Project') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Validating Project"
                    echo "======================================"

                    if [ ! -d essl-monitor/backend ]; then
                        echo "ERROR: Backend directory not found"
                        exit 1
                    fi

                    if [ ! -f essl-monitor/backend/package.json ]; then
                        echo "ERROR: package.json not found"
                        exit 1
                    fi

                    if [ ! -f essl-monitor/backend/src/server.js ]; then
                        echo "ERROR: server.js not found"
                        exit 1
                    fi

                    echo "Project structure OK"
                    echo "======================================"
                '''
            }
        }


        // =====================================================
        // INSTALL DEPENDENCIES
        // =====================================================

        stage('Install Dependencies') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Installing Dependencies"
                    echo "======================================"

                    cd essl-monitor/backend

                    if [ -f package-lock.json ]; then
                        npm ci
                    else
                        npm install
                    fi

                    echo "Dependencies installed successfully."
                    echo "======================================"
                '''
            }
        }


        // =====================================================
        // PREPARE PRODUCTION DIRECTORY
        // =====================================================

        stage('Prepare Production Directory') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Preparing Production Directory"
                    echo "======================================"

                    if [ ! -d "$APP_ROOT" ]; then
                        echo "ERROR: $APP_ROOT does not exist."
                        echo "Run once as administrator:"
                        echo "sudo mkdir -p /opt/essl-monitor"
                        echo "sudo chown -R jenkins:jenkins /opt/essl-monitor"
                        exit 1
                    fi

                    ls -ld "$APP_ROOT"

                    echo "Production directory ready."
                    echo "======================================"
                '''
            }
        }


        // =====================================================
        // CHECK DATABASE CONFIGURATION
        // =====================================================

        stage('Check Database Configuration') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Checking Database Configuration"
                    echo "======================================"

                    if [ ! -f "$ENV_FILE" ]; then
                        echo "ERROR: $ENV_FILE not found."
                        exit 1
                    fi

                    echo ".env file found."

                    for VAR in DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD
                    do
                        if ! grep -q "^${VAR}=" "$ENV_FILE"; then
                            echo "ERROR: ${VAR} missing from .env"
                            exit 1
                        fi

                        echo "${VAR} configured"
                    done

                    echo "Database configuration OK."
                    echo "======================================"
                '''
            }
        }


        // =====================================================
        // DEPLOY BACKEND
        // =====================================================

        stage('Deploy Backend') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Deploying Backend"
                    echo "======================================"

                    rm -rf "$APP_DIR"

                    mkdir -p "$APP_DIR"

                    cp -r essl-monitor/backend/package.json \
                          essl-monitor/backend/package-lock.json \
                          essl-monitor/backend/src \
                          "$APP_DIR/"

                    cp "$ENV_FILE" "$APP_DIR/.env"

                    echo "Backend files deployed."

                    echo "======================================"
                '''
            }
        }


        // =====================================================
        // INSTALL PRODUCTION DEPENDENCIES
        // =====================================================

        stage('Install Production Dependencies') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Installing Production Dependencies"
                    echo "======================================"

                    cd "$APP_DIR"

                    npm ci --omit=dev

                    echo "Production dependencies installed."

                    echo "======================================"
                '''
            }
        }


        // =====================================================
        // CREATE MIGRATION FILE
        // =====================================================

        stage('Create Migration File') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Creating Database Migration File"
                    echo "======================================"

                    mkdir -p "$APP_DIR/src/db"

                    cat > "$APP_DIR/src/db/migrate.js" <<'EOF'

'use strict';

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');


// ---------------------------------------------------------
// LOAD ENVIRONMENT
// ---------------------------------------------------------

const envFiles = [
    '/opt/essl-monitor/.env',
    '/opt/essl-monitor/current/.env',
    path.resolve(__dirname, '../../.env')
];

let loadedEnv = false;

for (const envFile of envFiles) {

    if (fs.existsSync(envFile)) {

        dotenv.config({
            path: envFile
        });

        console.log(
            '[Migrate] Loaded environment:',
            envFile
        );

        loadedEnv = true;

        break;
    }
}

if (!loadedEnv) {

    console.error(
        '[Migrate] ERROR: .env file not found'
    );

    process.exit(1);
}


// ---------------------------------------------------------
// DATABASE CONFIGURATION
// ---------------------------------------------------------

const DB_HOST =
    String(process.env.DB_HOST || '127.0.0.1').trim();

const DB_PORT =
    Number(process.env.DB_PORT || 5432);

const DB_NAME =
    String(process.env.DB_NAME || 'essl_attendance').trim();

const DB_USER =
    String(process.env.DB_USER || 'postgres').trim();

const DB_PASSWORD =
    String(process.env.DB_PASSWORD || '').trim();


// ---------------------------------------------------------
// DISPLAY CONFIGURATION
// ---------------------------------------------------------

console.log('');
console.log('======================================');
console.log(' eSSL Attendance Database Migration');
console.log('======================================');

console.log('Host:     ' + DB_HOST);
console.log('Port:     ' + DB_PORT);
console.log('Database: ' + DB_NAME);
console.log('User:     ' + DB_USER);

console.log(
    'Password: ' +
    (DB_PASSWORD ? 'configured' : 'NOT CONFIGURED')
);

console.log('======================================');
console.log('');


// ---------------------------------------------------------
// VALIDATE PASSWORD
// ---------------------------------------------------------

if (!DB_PASSWORD) {

    console.error(
        '[Migrate] ERROR: DB_PASSWORD is missing.'
    );

    process.exit(1);
}


// ---------------------------------------------------------
// POSTGRES CLIENT
// ---------------------------------------------------------

const client = new Client({

    host: DB_HOST,

    port: DB_PORT,

    database: DB_NAME,

    user: DB_USER,

    password: DB_PASSWORD

});


// ---------------------------------------------------------
// DATABASE SCHEMA
// ---------------------------------------------------------

const schema = `

CREATE TABLE IF NOT EXISTS employees (

    id SERIAL PRIMARY KEY,

    employee_code VARCHAR(100)
        UNIQUE NOT NULL,

    employee_name VARCHAR(255)
        NOT NULL,

    department VARCHAR(255),

    designation VARCHAR(255),

    email VARCHAR(255),

    phone VARCHAR(50),

    device_user_id VARCHAR(100),

    status VARCHAR(20)
        DEFAULT 'active',

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS devices (

    id SERIAL PRIMARY KEY,

    device_name VARCHAR(255)
        NOT NULL,

    model VARCHAR(100),

    ip_address VARCHAR(100)
        UNIQUE NOT NULL,

    port INTEGER
        DEFAULT 4370,

    serial_number VARCHAR(255),

    firmware_version VARCHAR(255),

    connection_status VARCHAR(30)
        DEFAULT 'OFFLINE',

    last_communication TIMESTAMP,

    user_count INTEGER
        DEFAULT 0,

    attendance_count INTEGER
        DEFAULT 0,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS attendance (

    id BIGSERIAL PRIMARY KEY,

    employee_id INTEGER
        REFERENCES employees(id)
        ON DELETE SET NULL,

    device_id INTEGER
        REFERENCES devices(id)
        ON DELETE SET NULL,

    device_user_id VARCHAR(100),

    punch_time TIMESTAMP NOT NULL,

    punch_date DATE NOT NULL,

    punch_type VARCHAR(20)
        DEFAULT 'NONE',

    verification_type VARCHAR(50),

    work_hours NUMERIC(10,2),

    late_minutes INTEGER
        DEFAULT 0,

    early_departure_minutes INTEGER
        DEFAULT 0,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(
        device_id,
        device_user_id,
        punch_time
    )
);


CREATE TABLE IF NOT EXISTS users (

    id SERIAL PRIMARY KEY,

    username VARCHAR(100)
        UNIQUE NOT NULL,

    password_hash TEXT
        NOT NULL,

    role VARCHAR(50)
        DEFAULT 'admin',

    status VARCHAR(20)
        DEFAULT 'active',

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS system_settings (

    id SERIAL PRIMARY KEY,

    setting_key VARCHAR(255)
        UNIQUE NOT NULL,

    setting_value TEXT,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_attendance_employee
ON attendance(employee_id);


CREATE INDEX IF NOT EXISTS idx_attendance_device
ON attendance(device_id);


CREATE INDEX IF NOT EXISTS idx_attendance_date
ON attendance(punch_date);


CREATE INDEX IF NOT EXISTS idx_attendance_time
ON attendance(punch_time);


CREATE INDEX IF NOT EXISTS idx_employees_status
ON employees(status);


CREATE INDEX IF NOT EXISTS idx_devices_status
ON devices(connection_status);

`;


// ---------------------------------------------------------
// RUN MIGRATION
// ---------------------------------------------------------

async function migrate() {

    console.log(
        '[Migrate] Applying schema to database:',
        DB_NAME
    );

    try {

        await client.connect();

        console.log(
            '[Migrate] PostgreSQL connection established.'
        );

        await client.query('BEGIN');

        await client.query(schema);

        await client.query('COMMIT');

        console.log('');
        console.log('======================================');
        console.log(' Database migration successful');
        console.log('======================================');

        console.log(
            'Database: ' + DB_NAME
        );

        console.log(
            'Host:     ' + DB_HOST
        );

        console.log(
            'Port:     ' + DB_PORT
        );

        console.log(
            'User:     ' + DB_USER
        );

        console.log('======================================');

    }

    catch (error) {

        console.error('');

        console.error(
            '[Migrate] Migration failed:'
        );

        console.error(
            error.message
        );

        try {

            await client.query('ROLLBACK');

        }

        catch (_) {}

        process.exitCode = 1;

    }

    finally {

        try {

            await client.end();

        }

        catch (_) {}

    }
}


migrate();

EOF

                    chmod 644 "$APP_DIR/src/db/migrate.js"

                    echo "Migration file created:"
                    ls -lh "$APP_DIR/src/db/migrate.js"

                    echo "======================================"
                '''
            }
        }


        // =====================================================
        // TEST DATABASE CONNECTION
        // =====================================================

        stage('Test Database Connection') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Testing PostgreSQL Connection"
                    echo "======================================"

                    set -a
                    . "$ENV_FILE"
                    set +a

                    if [ -z "$DB_PASSWORD" ]; then
                        echo "ERROR: DB_PASSWORD is empty."
                        exit 1
                    fi

                    PGPASSWORD="$DB_PASSWORD" \
                    psql \
                        -h "$DB_HOST" \
                        -p "$DB_PORT" \
                        -U "$DB_USER" \
                        -d "$DB_NAME" \
                        -c "SELECT current_database(), current_user;"

                    echo ""
                    echo "PostgreSQL connection successful."

                    echo "======================================"
                '''
            }
        }


        // =====================================================
        // RUN DATABASE MIGRATION
        // =====================================================

        stage('Run Database Migration') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Running Database Migration"
                    echo "======================================"

                    cd "$APP_DIR"

                    npm run migrate

                    echo "Database migration completed."

                    echo "======================================"
                '''
            }
        }


        // =====================================================
        // TEST APPLICATION
        // =====================================================

        stage('Test Application') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Testing Node.js Application"
                    echo "======================================"

                    cd "$APP_DIR"

                    node --check src/server.js

                    node --check src/db/migrate.js

                    echo "Node.js syntax check successful."

                    echo "======================================"
                '''
            }
        }


        // =====================================================
        // CONFIGURE PM2
        // =====================================================

        stage('Configure PM2') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Configuring PM2"
                    echo "======================================"

                    cd "$APP_DIR"

                    pm2 delete essl-attendance-monitor 2>/dev/null || true

                    pm2 start src/server.js \
                        --name essl-attendance-monitor \
                        --time

                    pm2 save

                    echo "PM2 application started."

                    pm2 status

                    echo "======================================"
                '''
            }
        }


        // =====================================================
        // HEALTH CHECK
        // =====================================================

        stage('Health Check') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Health Check"
                    echo "======================================"

                    sleep 5

                    echo "PM2 Status:"
                    pm2 status

                    echo ""
                    echo "Testing application port..."

                    if curl -f \
                        --max-time 10 \
                        http://127.0.0.1:${PORT}/
                    then

                        echo ""
                        echo "======================================"
                        echo "Application is healthy."
                        echo "======================================"

                    else

                        echo ""
                        echo "ERROR: Application health check failed."

                        pm2 logs essl-attendance-monitor \
                            --lines 50 \
                            --nostream || true

                        exit 1

                    fi
                '''
            }
        }
    }


    // =========================================================
    // POST ACTIONS
    // =========================================================

    post {

        success {

            echo '''
========================================
 eSSL Attendance Monitor
 Deployment SUCCESSFUL
========================================
Application:
http://172.16.0.111:5001/

PM2:
essl-attendance-monitor

Database:
essl_attendance

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
