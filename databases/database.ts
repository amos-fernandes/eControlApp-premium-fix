import { openDatabaseSync } from 'expo-sqlite'

let _db: any = null
export const getDB = () => {
    if (!_db) {
        _db = openDatabaseSync('econtrole.db')
    }
    return _db
}

/**
 * Inicializa o esquema de tabelas do banco de dados SQLite.
 */
export const initDatabase = () => {
    const db = getDB()
    db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS credentials (
      _id TEXT PRIMARY KEY NOT NULL,
      accessToken TEXT,
      uid TEXT,
      client TEXT,
      userId INTEGER,
      driver_employee_id INTEGER,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      _id TEXT PRIMARY KEY NOT NULL,
      email TEXT,
      name TEXT,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS service_orders (
      id INTEGER PRIMARY KEY NOT NULL,
      identifier TEXT,
      status TEXT,
      service_date TEXT,
      customer_id INTEGER,
      customer_name TEXT,
      address_text TEXT,
      latitude REAL,
      longitude REAL,
      user_auth_id INTEGER,
      driver_employee_id INTEGER,
      validation_code TEXT,
      contacts_json TEXT,
      observations TEXT,
      driver_observations TEXT,
      created_at TEXT,
      vehicle_info TEXT,
      voyage_info TEXT
    );
    `);

    // Migrações: Adicionar colunas se não existirem (Código JavaScript fora do SQL)
    try { db.execSync('ALTER TABLE service_orders ADD COLUMN latitude REAL;'); } catch (e) {}
    try { db.execSync('ALTER TABLE service_orders ADD COLUMN longitude REAL;'); } catch (e) {}
    try { db.execSync('ALTER TABLE service_orders ADD COLUMN user_auth_id INTEGER;'); } catch (e) {}
    try { db.execSync('ALTER TABLE service_orders ADD COLUMN driver_employee_id INTEGER;'); } catch (e) {}
    try { db.execSync('ALTER TABLE service_orders ADD COLUMN validation_code TEXT;'); } catch (e) {}
    try { db.execSync('ALTER TABLE service_orders ADD COLUMN contacts_json TEXT;'); } catch (e) {}

    // Migrações para credentials
    try { db.execSync('ALTER TABLE credentials ADD COLUMN userId INTEGER;'); } catch (e) {}
    try { db.execSync('ALTER TABLE credentials ADD COLUMN driver_employee_id INTEGER;'); } catch (e) {}

    db.execSync(`
    CREATE TABLE IF NOT EXISTS service_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_order_id INTEGER,
      service_name TEXT,
      amount INTEGER,
      unit_name TEXT,
      item_weights TEXT,
      FOREIGN KEY(service_order_id) REFERENCES service_orders(id)
    );

    CREATE TABLE IF NOT EXISTS service_order_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_order_id INTEGER,
      image_url TEXT,
      image_path TEXT,
      created_at TEXT,
      FOREIGN KEY(service_order_id) REFERENCES service_orders(id)
    );

    CREATE TABLE IF NOT EXISTS mtrs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_order_id INTEGER,
      mtr_id TEXT UNIQUE,
      status TEXT,
      emission_date TEXT,
      download_path TEXT,
      created_at TEXT,
      FOREIGN KEY(service_order_id) REFERENCES service_orders(id)
    );

    CREATE TABLE IF NOT EXISTS service_order_drafts (
      id INTEGER PRIMARY KEY NOT NULL,
      draft_data TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS device_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      speed REAL,
      heading REAL,
      accuracy REAL,
      timestamp TEXT NOT NULL,
      synced INTEGER DEFAULT 0,
      created_at TEXT
    );

    -- ============================================
    -- TABELAS DE LOGÍSTICA (Feature v1.10.0)
    -- ============================================
    
    -- Métricas diárias por motorista
    CREATE TABLE IF NOT EXISTS daily_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      driver_id TEXT NOT NULL,
      driver_name TEXT,
      date TEXT NOT NULL,
      total_os INTEGER DEFAULT 0,
      total_km REAL DEFAULT 0,
      total_fuel_liters REAL,
      total_time_hours REAL DEFAULT 0,
      on_time_deliveries INTEGER DEFAULT 0,
      late_deliveries INTEGER DEFAULT 0,
      avg_time_per_os REAL DEFAULT 0,
      avg_km_per_os REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(driver_id, date)
    );

    -- Métricas por veículo
    CREATE TABLE IF NOT EXISTS vehicle_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id TEXT NOT NULL,
      vehicle_name TEXT,
      date TEXT NOT NULL,
      km_start REAL DEFAULT 0,
      km_end REAL DEFAULT 0,
      total_km REAL DEFAULT 0,
      fuel_liters REAL,
      os_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'operating',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(vehicle_id, date)
    );

    -- Métricas consolidadas mensais
    CREATE TABLE IF NOT EXISTS monthly_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      year INTEGER NOT NULL,
      total_os INTEGER DEFAULT 0,
      total_km REAL DEFAULT 0,
      total_fuel_liters REAL,
      total_fuel_cost REAL,
      avg_km_per_os REAL DEFAULT 0,
      avg_time_per_os REAL DEFAULT 0,
      fuel_efficiency REAL,
      on_time_percentage REAL DEFAULT 0,
      route_optimization_percentage REAL,
      productivity REAL,
      fleet_utilization REAL,
      cost_savings REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(month, year)
    );

    -- ============================================
    -- FIM DAS TABELAS DE LOGÍSTICA
    -- ============================================
  `)
}

/**
 * Insere uma nova localização capturada para rastreamento.
 */
export const insertDeviceLocation = (loc: any) => {
    const db = getDB()
    db.runSync(
        `INSERT INTO device_locations (
      latitude, longitude, speed, heading, accuracy, timestamp, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            loc.latitude,
            loc.longitude,
            loc.speed || 0,
            loc.heading || 0,
            loc.accuracy || 0,
            loc.timestamp || new Date().toISOString(),
            new Date().toISOString(),
        ],
    )
}

/**
 * Obtém localizações não sincronizadas.
 */
export const getUnsyncedLocations = (limit = 100) => {
    const db = getDB()
    return db.getAllSync('SELECT * FROM device_locations WHERE synced = 0 ORDER BY timestamp ASC LIMIT ?', [limit])
}

/**
 * Marca localizações como sincronizadas.
 */
export const markLocationsAsSynced = (ids: number[]) => {
    const db = getDB()
    if (ids.length === 0) return
    const placeholders = ids.map(() => '?').join(',')
    db.runSync(`UPDATE device_locations SET synced = 1 WHERE id IN (${placeholders})`, ids)
}

/**
 * Limpa localizações antigas (já sincronizadas).
 */
export const clearSyncedLocations = () => {
    const db = getDB()
    db.runSync('DELETE FROM device_locations WHERE synced = 1')
}

/**
 * Salva um rascunho de coleta para uma ordem de serviço.
 */
export const saveServiceOrderDraft = (id: number | string, data: any) => {
    const db = getDB()
    db.runSync(
        'INSERT OR REPLACE INTO service_order_drafts (id, draft_data, updated_at) VALUES (?, ?, ?)',
        [id, JSON.stringify(data), new Date().toISOString()],
    )
}

/**
 * Obtém o rascunho de coleta de uma ordem de serviço.
 */
export const getServiceOrderDraft = (id: number | string) => {
    const db = getDB()
    const row: any = db.getFirstSync('SELECT * FROM service_order_drafts WHERE id = ?', [id])
    return row ? JSON.parse(row.draft_data) : null
}

/**
 * Remove o rascunho de coleta de uma ordem de serviço.
 */
export const deleteServiceOrderDraft = (id: number | string) => {
    const db = getDB()
    db.runSync('DELETE FROM service_order_drafts WHERE id = ?', [id])
}

/**
 * Insere uma imagem associada a uma ordem de serviço.
 */
export const insertServiceOrderImage = (serviceOrderId: number, imageUrl: string, imagePath: string) => {
    const db = getDB()
    db.runSync(
        'INSERT INTO service_order_images (service_order_id, image_url, image_path, created_at) VALUES (?, ?, ?, ?)',
        [serviceOrderId, imageUrl, imagePath, new Date().toISOString()],
    )
}

/**
 * Obtém todas as imagens associadas a uma ordem de serviço.
 */
export const getServiceOrderImages = (serviceOrderId: number) => {
    const db = getDB()
    return db.getAllSync('SELECT * FROM service_order_images WHERE service_order_id = ?', [serviceOrderId])
}

/**
 * Remove todas as imagens associadas a uma ordem de serviço.
 */
 export const deleteServiceOrderImages = (serviceOrderId: number) => {
    const db = getDB()
    db.runSync('DELETE FROM service_order_images WHERE service_order_id = ?', [serviceOrderId])
}

/**
 * Insere ou atualiza as credenciais de autenticacao.
 */
export const insertCredentials = (cred: any) => {
    console.log('[SQLITE-DEBUG] 💾 Salvando credenciais:', JSON.stringify({
        uid: cred.uid,
        userId: cred.userId,
        driver_employee_id: cred.driver_employee_id,
        hasToken: !!cred.accessToken
    }, null, 2));
    
    const db = getDB()
    db.runSync(
        'INSERT OR REPLACE INTO credentials (_id, accessToken, uid, client, userId, driver_employee_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
            cred._id || 'main',
            cred.accessToken,
            cred.uid,
            cred.client,
            cred.userId,
            cred.driver_employee_id,
            new Date().toISOString()
        ],
    )
}

/**
 * Insere ou atualiza os dados do usuario.
 */
export const insertUser = (user: any) => {
    const db = getDB()
    db.runSync('INSERT OR REPLACE INTO users (_id, email, name, created_at) VALUES (?, ?, ?, ?)', [
        user._id,
        user.email,
        user.name,
        new Date().toISOString(),
    ])
}

/**
 * Realiza a insercao de uma Ordem de Servico de forma atomica.
 */
export const insertServiceOrder = (order: any) => {
    const db = getDB()
    db.withTransactionSync(() => {
        db.runSync(
            `INSERT OR REPLACE INTO service_orders (
        id, identifier, status, service_date, customer_id, customer_name,
        address_text, latitude, longitude, user_auth_id, driver_employee_id, validation_code, contacts_json,
        observations, driver_observations, created_at, vehicle_info, voyage_info
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                order.id,
                order.identifier,
                order.status,
                order.service_date,
                order.customer_id,
                order.customer?.name,
                order.address?.to_s || order.address?.name,
                order.address?.latitude || order.latitude,
                order.address?.longitude || order.longitude,
                order.user_auth?.id || order.user_auth_id,
                order.driver_employee_id,
                order.contacts?.[0]?.validation_code || order.validation_code,
                order.contacts ? JSON.stringify(order.contacts) : (order.contacts_json || null),
                order.observations,
                order.driver_observations,
                order.created_at,
                order.vehicle ? JSON.stringify(order.vehicle) : null,
                order.voyage ? JSON.stringify(order.voyage) : null,
            ],
        )

        db.runSync('DELETE FROM service_executions WHERE service_order_id = ?', [order.id])

        if (Array.isArray(order.service_executions)) {
            order.service_executions.forEach((exec: any) => {
                db.runSync(
                    `INSERT INTO service_executions (
            service_order_id, service_name, amount, unit_name, item_weights
          ) VALUES (?, ?, ?, ?, ?)`,
                    [
                        order.id,
                        exec.service?.name,
                        exec.amount,
                        exec.unit?.name,
                        exec.service_item_weights ? JSON.stringify(exec.service_item_weights) : null,
                    ],
                )
            })
        }
    })
}

/**
 * Insere uma Ordem de Servico SEM transação (para uso em batch).
 * Usado apenas dentro de transações externas.
 */
export const insertServiceOrderNoTransaction = (order: any, db: any) => {
    db.runSync(
        `INSERT OR REPLACE INTO service_orders (
        id, identifier, status, service_date, customer_id, customer_name,
        address_text, latitude, longitude, user_auth_id, driver_employee_id, validation_code, contacts_json,
        observations, driver_observations, created_at, vehicle_info, voyage_info
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            order.id,
            order.identifier,
            order.status,
            order.service_date,
            order.customer_id,
            order.customer?.name,
            order.address?.to_s || order.address?.name,
            order.address?.latitude || order.latitude,
            order.address?.longitude || order.longitude,
            order.user_auth?.id || order.user_auth_id,
            order.driver_employee_id,
            order.contacts?.[0]?.validation_code || order.validation_code,
            order.contacts ? JSON.stringify(order.contacts) : (order.contacts_json || null),
            order.observations,
            order.driver_observations,
            order.created_at,
            order.vehicle ? JSON.stringify(order.vehicle) : null,
            order.voyage ? JSON.stringify(order.voyage) : null,
        ],
    )

    db.runSync('DELETE FROM service_executions WHERE service_order_id = ?', [order.id])

    if (Array.isArray(order.service_executions)) {
        order.service_executions.forEach((exec: any) => {
            db.runSync(
                `INSERT INTO service_executions (
            service_order_id, service_name, amount, unit_name, item_weights
          ) VALUES (?, ?, ?, ?, ?)`,
                [
                    order.id,
                    exec.service?.name,
                    exec.amount,
                    exec.unit?.name,
                    exec.service_item_weights ? JSON.stringify(exec.service_item_weights) : null,
                ],
            )
        })
    }
}

/**
 * Retorna todas as Ordens de Servico armazenadas localmente.
 */
export const getServiceOrders = () => {
    const db = getDB()
    return db.getAllSync('SELECT * FROM service_orders ORDER BY created_at DESC')
}

/**
 * Obtém uma Ordem de Servico específica pelo ID.
 */
export const getServiceOrder = (id: number) => {
    const db = getDB()
    return db.getFirstSync('SELECT * FROM service_orders WHERE id = ?', [id])
}

/**
 * Obtem a credencial ativa.
 */
export const getCredentials = () => {
    const db = getDB()
    return db.getFirstSync('SELECT * FROM credentials LIMIT 1')
}

/**
 * Insere ou atualiza uma MTR emitida.
 */
export const insertMTR = (serviceOrderId: number, mtrId: string, status: string, emissionDate?: string) => {
    const db = getDB()
    db.runSync(
        'INSERT OR REPLACE INTO mtrs (service_order_id, mtr_id, status, emission_date, created_at) VALUES (?, ?, ?, ?, ?)',
        [serviceOrderId, mtrId, status, emissionDate || new Date().toISOString(), new Date().toISOString()],
    )
}

/**
 * Obtém as MTRs emitidas para uma ordem de serviço específica.
 */
export const getMTRsByServiceOrder = (serviceOrderId: number) => {
    const db = getDB()
    return db.getAllSync('SELECT * FROM mtrs WHERE service_order_id = ?', [serviceOrderId])
}

/**
 * Obtém uma MTR específica pelo ID.
 */
export const getMTRById = (mtrId: string) => {
    const db = getDB()
    return db.getFirstSync('SELECT * FROM mtrs WHERE mtr_id = ?', [mtrId])
}

/**
 * Atualiza o status de uma MTR.
 */
export const updateMTRStatus = (mtrId: string, status: string) => {
    const db = getDB()
    db.runSync('UPDATE mtrs SET status = ?, created_at = ? WHERE mtr_id = ?', [status, new Date().toISOString(), mtrId])
}

/**
 * Limpa todos os dados locais.
 */
export const clearDatabase = () => {
    const db = getDB()
    db.execSync(
        'DELETE FROM service_orders; DELETE FROM service_executions; DELETE FROM credentials; DELETE FROM users; DELETE FROM mtrs;',
    )
}