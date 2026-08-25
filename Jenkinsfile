pipeline {
    agent any

    environment {
        APP_NAME = "essl-attendance-monitor"
        APP_ROOT = "/opt/essl-monitor"
        CURRENT = "/opt/essl-monitor/current"
        BACKEND = "essl-monitor/backend"
        PORT = "5001"
        HOST = "0.0.0.0"
    }

    stages {

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

        stage('Validate Project') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Validating Project"
                    echo "======================================"

                    test -d "$BACKEND"
                    test -f "$BACKEND/package.json"
                    test -f "$BACKEND/src/server.js"

                    echo "Project structure OK"

                    echo "======================================"
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Installing Dependencies"
                    echo "======================================"

                    cd "$BACKEND"

                    if [ -f package-lock.json ]; then
                        npm ci
                    else
                        npm install
                    fi

                    echo "Dependencies installed."

                    echo "======================================"
                '''
            }
        }

        stage('Prepare Production Directory') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Preparing Production Directory"
                    echo "======================================"

                    mkdir -p "$APP_ROOT"
                    mkdir -p "$CURRENT"

                    echo "Production directory:"
                    ls -ld "$APP_ROOT"

                    echo "======================================"
                '''
            }
        }

        stage('Check Database Configuration') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Checking Database Configuration"
                    echo "======================================"

                    ENV_FILE="$APP_ROOT/.env"

                    if [ ! -f "$ENV_FILE" ]; then
                        echo "ERROR: $ENV_FILE does not exist."
                        echo ""
                        echo "Create it once with:"
                        echo "DB_HOST=127.0.0.1"
                        echo "DB_PORT=5432"
                        echo "DB_NAME=essl_attendance"
                        echo "DB_USER=postgres"
                        echo "DB_PASSWORD=your_password"
                        exit 1
                    fi

                    for VAR in DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD
                    do
                        if ! grep -q "^${VAR}=" "$ENV_FILE"; then
                            echo "ERROR: ${VAR} is missing from $ENV_FILE"
                            exit 1
                        fi
                    done

                    echo "Database configuration found."

                    echo "======================================"
                '''
            }
        }

        stage('Deploy Backend') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Deploying Backend"
                    echo "======================================"

                    rm -rf "$CURRENT"
                    mkdir -p "$CURRENT"

                    cp -r "$BACKEND/package.json" "$CURRENT/"
                    cp -r "$BACKEND/package-lock.json" "$CURRENT/"
                    cp -r "$BACKEND/src" "$CURRENT/"

                    cp "$APP_ROOT/.env" "$CURRENT/.env"

                    echo "Backend deployed."

                    echo "======================================"
                '''
            }
        }

        stage('Install Production Dependencies') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Installing Production Dependencies"
                    echo "======================================"

                    cd "$CURRENT"

                    npm ci --omit=dev

                    echo "Production dependencies installed."

                    echo "======================================"
                '''
            }
        }

        stage('Create Database Migration') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Creating Database Migration"
                    echo "======================================"

                    mkdir -p "$CURRENT/src/db"

                    cat > "$CURRENT/src/db/migrate.js" <<'NODE'
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const envFile = "/opt/essl-monitor/.env";

if (fs.existsSync(envFile)) {
    require("dotenv").config({
        path: envFile
    });

    console.log("[Migrate] Loaded environment:", envFile);
} else {
    console.error("[Migrate] ERROR: .env file not found");
    process.exit(1);
}

const config = {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || "essl_attendance",
    user: process.env.DB_USER || "postgres",
    password: String(process.env.DB_PASSWORD || "")
};

console.log("");
console.log("======================================");
console.log(" eSSL Attendance Database Migration");
console.log("======================================");
console.log("Host:    ", config.host);
console.log("Port:    ", config.port);
console.log("Database:", config.database);
console.log("User:    ", config.user);
console.log("Password:", config.password ? "configured" : "NOT CONFIGURED");
console.log("======================================");
console.log("");

if (!config.password) {
    console.error("[Migrate] ERROR: DB_PASSWORD is empty.");
    process.exit(1);
}

const client = new Client(config);

async function columnExists(tableName, columnName) {
    const result = await client.query(
        `
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
        ) AS exists
        `,
        [tableName, columnName]
    );

    return result.rows[0].exists;
}

async function createColumn(tableName, columnName, definition) {
    const exists = await columnExists(tableName, columnName);

    if (!exists) {
        console.log(
            `[Migrate] Adding ${tableName}.${columnName}`
        );

        await client.query(
            `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${definition}`
        );
    }
}

async function migrate() {

    await client.query("BEGIN");

    try {

        console.log(
            `[Migrate] Applying schema to database: ${config.database}`
        );

        /*
         * USERS
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS employees (
                id BIGSERIAL PRIMARY KEY,
                employee_code VARCHAR(100) UNIQUE,
                employee_id VARCHAR(100),
                name VARCHAR(200) NOT NULL,
                department VARCHAR(200),
                designation VARCHAR(200),
                email VARCHAR(255),
                phone VARCHAR(50),
                device_user_id VARCHAR(100),
                photo TEXT,
                status VARCHAR(20) NOT NULL DEFAULT 'active',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        /*
         * IMPORTANT:
         * Existing installations may already have employees table
         * without status.
         *
         * Add status before using it in indexes/queries.
         */
        await createColumn(
            "employees",
            "status",
            "VARCHAR(20) NOT NULL DEFAULT 'active'"
        );

        await createColumn(
            "employees",
            "employee_code",
            "VARCHAR(100)"
        );

        await createColumn(
            "employees",
            "department",
            "VARCHAR(200)"
        );

        await createColumn(
            "employees",
            "designation",
            "VARCHAR(200)"
        );

        await createColumn(
            "employees",
            "email",
            "VARCHAR(255)"
        );

        await createColumn(
            "employees",
            "phone",
            "VARCHAR(50)"
        );

        await createColumn(
            "employees",
            "device_user_id",
            "VARCHAR(100)"
        );

        await createColumn(
            "employees",
            "photo",
            "TEXT"
        );

        await createColumn(
            "employees",
            "created_at",
            "TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        );

        await createColumn(
            "employees",
            "updated_at",
            "TIMESTAMPTZ NOT NULL DEFAULT NOW()"
        );

        /*
         * DEVICES
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS devices (
                id BIGSERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                model VARCHAR(100),
                ip_address VARCHAR(100) NOT NULL,
                port INTEGER NOT NULL DEFAULT 4370,
                serial_number VARCHAR(200),
                firmware_version VARCHAR(200),
                status VARCHAR(20) NOT NULL DEFAULT 'offline',
                user_count INTEGER DEFAULT 0,
                attendance_count INTEGER DEFAULT 0,
                last_communication TIMESTAMPTZ,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        /*
         * ATTENDANCE
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id BIGSERIAL PRIMARY KEY,
                employee_id BIGINT,
                employee_code VARCHAR(100),
                device_id BIGINT,
                device_user_id VARCHAR(100),
                punch_time TIMESTAMPTZ NOT NULL,
                punch_type VARCHAR(20),
                direction VARCHAR(20),
                verify_type VARCHAR(50),
                work_date DATE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                CONSTRAINT fk_attendance_employee
                    FOREIGN KEY (employee_id)
                    REFERENCES employees(id)
                    ON DELETE SET NULL,

                CONSTRAINT fk_attendance_device
                    FOREIGN KEY (device_id)
                    REFERENCES devices(id)
                    ON DELETE SET NULL
            )
        `);

        /*
         * ATTENDANCE STATUS
         *
         * This is added separately so an old database
         * will not fail with:
         *
         * column "status" does not exist
         */
        await createColumn(
            "attendance",
            "status",
            "VARCHAR(30) DEFAULT 'valid'"
        );

        await createColumn(
            "attendance",
            "direction",
            "VARCHAR(20)"
        );

        await createColumn(
            "attendance",
            "punch_type",
            "VARCHAR(20)"
        );

        await createColumn(
            "attendance",
            "work_date",
            "DATE"
        );

        await createColumn(
            "attendance",
            "verify_type",
            "VARCHAR(50)"
        );

        /*
         * DEVICES - ensure columns exist for old installations
         */
        await createColumn(
            "devices",
            "status",
            "VARCHAR(20) NOT NULL DEFAULT 'offline'"
        );

        await createColumn(
            "devices",
            "enabled",
            "BOOLEAN NOT NULL DEFAULT TRUE"
        );

        await createColumn(
            "devices",
            "last_communication",
            "TIMESTAMPTZ"
        );

        /*
         * USERS / LOGIN
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS admin_users (
                id BIGSERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name VARCHAR(200),
                role VARCHAR(50) NOT NULL DEFAULT 'admin',
                status VARCHAR(20) NOT NULL DEFAULT 'active',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        /*
         * SETTINGS
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS attendance_settings (
                id BIGSERIAL PRIMARY KEY,
                setting_key VARCHAR(150) UNIQUE NOT NULL,
                setting_value TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        /*
         * AUDIT LOG
         */
        await client.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT,
                action VARCHAR(100),
                description TEXT,
                ip_address VARCHAR(100),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        /*
         * INDEXES
         *
         * status columns are guaranteed to exist before
         * indexes are created.
         */

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_employees_status
            ON employees(status)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_employees_employee_code
            ON employees(employee_code)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_attendance_employee
            ON attendance(employee_id)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_attendance_punch_time
            ON attendance(punch_time)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_attendance_work_date
            ON attendance(work_date)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_attendance_status
            ON attendance(status)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_devices_status
            ON devices(status)
        `);

        /*
         * DEFAULT SETTINGS
         */
        await client.query(`
            INSERT INTO attendance_settings
                (setting_key, setting_value)
            VALUES
                ('timezone', 'Asia/Kolkata'),
                ('attendance_mode', 'dynamic'),
                ('office_start_time', '09:00'),
                ('office_end_time', '18:00'),
                ('late_threshold_minutes', '15'),
                ('early_departure_threshold_minutes', '15')
            ON CONFLICT (setting_key)
            DO NOTHING
        `);

        await client.query("COMMIT");

        console.log("");
        console.log("======================================");
        console.log(" DATABASE MIGRATION SUCCESSFUL");
        console.log("======================================");
        console.log("");

    } catch (error) {

        await client.query("ROLLBACK");

        console.error("");
        console.error("[Migrate] Migration failed:");
        console.error(error.message);
        console.error("");

        process.exit(1);
    }
}

async function main() {

    try {

        console.log(
            "[Migrate] Connecting to PostgreSQL..."
        );

        await client.connect();

        console.log(
            "[Migrate] PostgreSQL connection established."
        );

        await migrate();

        await client.end();

        process.exit(0);

    } catch (error) {

        console.error(
            "[Migrate] PostgreSQL connection/migration error:"
        );

        console.error(error.message);

        try {
            await client.end();
        } catch (_) {}

        process.exit(1);
    }
}

main();
NODE

                    chmod 644 "$CURRENT/src/db/migrate.js"

                    echo "Migration file created."

                    ls -lh "$CURRENT/src/db/migrate.js"

                    echo "======================================"
                '''
            }
        }

        stage('Test Database Connection') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Testing PostgreSQL Connection"
                    echo "======================================"

                    set -a
                    . "$APP_ROOT/.env"
                    set +a

                    if [ -z "$DB_PASSWORD" ]; then
                        echo "ERROR: DB_PASSWORD is empty."
                        exit 1
                    fi

                    PGPASSWORD="$DB_PASSWORD" psql \
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

        stage('Run Database Migration') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Running Database Migration"
                    echo "======================================"

                    cd "$CURRENT"

                    npm run migrate

                    echo "Database migration successful."

                    echo "======================================"
                '''
            }
        }

        stage('Test Application') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Testing Node.js Application"
                    echo "======================================"

                    cd "$CURRENT"

                    node --check src/server.js

                    echo "Node.js syntax check successful."

                    echo "======================================"
                '''
            }
        }

        stage('Configure PM2') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Configuring PM2"
                    echo "======================================"

                    cd "$CURRENT"

                    if pm2 describe "$APP_NAME" > /dev/null 2>&1; then

                        echo "Existing PM2 application found."
                        echo "Restarting application..."

                        pm2 restart "$APP_NAME" --update-env

                    else

                        echo "Starting new PM2 application..."

                        pm2 start src/server.js \
                            --name "$APP_NAME" \
                            --cwd "$CURRENT" \
                            --time

                    fi

                    pm2 save

                    echo ""
                    pm2 status

                    echo "======================================"
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Application Health Check"
                    echo "======================================"

                    sleep 5

                    if ! pm2 describe "$APP_NAME" > /dev/null 2>&1; then
                        echo "ERROR: PM2 application is not running."
                        pm2 status
                        exit 1
                    fi

                    pm2 status

                    echo ""
                    echo "Checking application port..."

                    if ss -ltn | grep -q ":${PORT} "; then
                        echo "Application is listening on port $PORT."
                    else
                        echo "WARNING: Port $PORT is not listening."
                        echo "Check PM2 logs:"
                        echo "pm2 logs $APP_NAME"
                        exit 1
                    fi

                    echo ""
                    echo "======================================"
                    echo " DEPLOYMENT SUCCESSFUL"
                    echo "======================================"
                    echo "Application: $APP_NAME"
                    echo "Port:        $PORT"
                    echo "Directory:   $CURRENT"
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
 Deployment SUCCESSFUL
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

Useful commands:

pm2 status
pm2 logs essl-attendance-monitor
sudo -u postgres psql -d essl_attendance
'''
        }

        always {
            echo "Jenkins pipeline completed."
        }
    }
}
