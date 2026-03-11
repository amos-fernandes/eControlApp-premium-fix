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
      observations TEXT,
      driver_observations TEXT,
      created_at TEXT,
      vehicle_info TEXT,
      voyage_info TEXT
    );

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
  `)
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
    const db = getDB()
    db.runSync(
        'INSERT OR REPLACE INTO credentials (_id, accessToken, uid, client, created_at) VALUES (?, ?, ?, ?, ?)',
        [cred._id || 'main', cred.accessToken, cred.uid, cred.client, new Date().toISOString()],
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
        address_text, observations, driver_observations, created_at, vehicle_info, voyage_info
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                order.id,
                order.identifier,
                order.status,
                order.service_date,
                order.customer_id,
                order.customer?.name,
                order.address?.to_s || order.address?.name,
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
        address_text, observations, driver_observations, created_at, vehicle_info, voyage_info
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            order.id,
            order.identifier,
            order.status,
            order.service_date,
            order.customer_id,
            order.customer?.name,
            order.address?.to_s || order.address?.name,
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