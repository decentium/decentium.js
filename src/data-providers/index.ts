/** Defines an interface that Decentium data providers need to implement. */

export interface DataProvider {
    /** Should return a transaction by id. */
    getTransaction(txId: string, blockNum: number): Promise<Transaction>
    /** Should return the contents of an EOSIO table query. */
    getTableRows<T = any>(query: TableQuery): Promise<TableResponse<T>>
}

export interface Action<T = any> {
    account: string
    name: string
    authorization: Array<{actor: string; permission: string}>
    data: T
}

export interface Transaction {
    id: string
    actions: Action[]
}

export interface Block {
    block_num: number
    transactions: Transaction[]
}

export interface TableQuery {
    code: string
    encode_type?: any
    index_position?: any
    key_type?: any
    limit?: any
    lower_bound?: any
    reverse?: boolean
    scope: string
    table: string
    upper_bound?: any
}

export interface TableResponse<T = any> {
    rows: T[]
    more: boolean
}
