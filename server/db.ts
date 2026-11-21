/**
 * 数据库抽象层。
 * 生产：Cloudflare D1
 * 本地/测试：Node 24 内置的 node:sqlite
 * 两者都实现同一套 prepare/bind/first/all/run 接口。
 */

export interface PreparedStatement {
  bind(...values: unknown[]): PreparedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<T[]>
  run(): Promise<void>
}

export interface DB {
  prepare(sql: string): PreparedStatement
  exec(sql: string): Promise<void>
}

/* ---------------- Node（本地开发 / 测试） ---------------- */

interface SqliteStatement {
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
  run(...params: unknown[]): unknown
}

interface SqliteDatabase {
  exec(sql: string): void
  prepare(sql: string): SqliteStatement
}

function normalise(values: unknown[]): unknown[] {
  return values.map((v) => (v === undefined ? null : v))
}

class NodeStatement implements PreparedStatement {
  private bound: unknown[] = []
  constructor(
    private db: SqliteDatabase,
    private sql: string,
  ) {}

  bind(...values: unknown[]): PreparedStatement {
    this.bound = normalise(values)
    return this
  }

  async first<T>(): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.bound)
    return (row as T) ?? null
  }

  async all<T>(): Promise<T[]> {
    return this.db.prepare(this.sql).all(...this.bound) as T[]
  }

  async run(): Promise<void> {
    this.db.prepare(this.sql).run(...this.bound)
  }
}

export type SqliteCtor = new (path: string) => SqliteDatabase

class NodeDB implements DB {
  private db: SqliteDatabase
  constructor(path: string, Ctor: SqliteCtor) {
    this.db = new Ctor(path)
    this.db.exec('PRAGMA journal_mode = WAL;')
  }
  prepare(sql: string): PreparedStatement {
    return new NodeStatement(this.db, sql)
  }
  async exec(sql: string): Promise<void> {
    this.db.exec(sql)
  }
}

/**
 * 本地开发 / 测试用。
 * 把 DatabaseSync 从外面传进来，这样 Worker 环境不会去解析 node:sqlite。
 */
export function createNodeDb(path: string, Ctor: SqliteCtor): DB {
  return new NodeDB(path, Ctor)
}

/* ---------------- Cloudflare D1 ---------------- */

interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike
  first<T>(): Promise<T | null>
  all<T>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
}

interface D1Like {
  prepare(sql: string): D1StatementLike
  exec(sql: string): Promise<unknown>
}

class D1Statement implements PreparedStatement {
  constructor(private stmt: D1StatementLike) {}
  bind(...values: unknown[]): PreparedStatement {
    return new D1Statement(this.stmt.bind(...normalise(values)))
  }
  async first<T>(): Promise<T | null> {
    return (await this.stmt.first<T>()) ?? null
  }
  async all<T>(): Promise<T[]> {
    const res = await this.stmt.all<T>()
    return res.results ?? []
  }
  async run(): Promise<void> {
    await this.stmt.run()
  }
}

class D1DB implements DB {
  constructor(private d1: D1Like) {}
  prepare(sql: string): PreparedStatement {
    return new D1Statement(this.d1.prepare(sql))
  }
  async exec(sql: string): Promise<void> {
    await this.d1.exec(sql)
  }
}

export function createD1Db(d1: unknown): DB {
  return new D1DB(d1 as D1Like)
}
