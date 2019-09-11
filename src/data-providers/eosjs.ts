import {JsonRpc, Serialize} from 'eosjs'
import * as LRU from 'lru-cache'
import {sleep} from '../utils'
import {Action, Block, DataProvider, TableQuery, TableResponse, Transaction} from './index'

export interface EosjsDataProviderOptions {
    /** How many blocks to keep before starting to evict from the LRU cache. */
    blockCacheSize?: number
    /** List of contracts, if provided only actions involving given contracts will be returned. */
    whitelist?: string[]
}

export class EosjsDataProvider implements DataProvider {
    public readonly blockCache: LRU<number, Block>
    private txIndex: Map<string, number>

    private useWhitelist = false
    private whitelist = new Set<string>()

    /**
     * Map of contracts to types, will be used to decode action data in case
     * EOS node bails on decoding and sends it as a hex encoded string instead.
     */
    private contracts = new Map<string, Serialize.Contract | null>()

    constructor(
        public readonly rpc: JsonRpc,
        public readonly options: EosjsDataProviderOptions = {}
    ) {
        this.txIndex = new Map()
        this.blockCache = new LRU({
            max: options.blockCacheSize || 10000,
            dispose: (blockNum, block) => {
                for (const tx of block.transactions) {
                    this.txIndex.delete(tx.id)
                }
            },
        })
        if (options.whitelist) {
            this.useWhitelist = true
            for (const contract of options.whitelist) {
                this.whitelist.add(contract)
            }
        }
    }

    public getTableRows<T>(query: TableQuery): Promise<TableResponse<T>> {
        const req: any = {
            ...query,
            json: true,
        }
        return this.call('/v1/chain/get_table_rows', req)
    }

    public async getTransaction(txId: string, blockNum: number) {
        if (this.txIndex.has(txId)) {
            blockNum = this.txIndex.get(txId)! // in case reference block num was updated during fetch
            const block = this.blockCache.get(blockNum)! // guaranteed hit if index has it
            return block.transactions.find(({id}) => id === txId)!
        }
        const fetchTx = async (num: number) => {
            const block = await this.getBlock(num)
            return block.transactions.find((t) => t.id === txId)
        }
        let tx = await fetchTx(blockNum)
        // lookaround if tx is not fund in given block
        if (!tx) {
            const numbers = [1, -1, 2, -2].map((i) => blockNum + i)
            for (const num of numbers) {
                tx = await fetchTx(num)
                if (tx) {
                    break
                }
            }
        }
        // TODO: fallback to history api if possible - v1/history/get_transaction
        if (!tx) {
            throw new Error(`Unable to find transaction: ${txId}`)
        }
        return tx
    }

    public async getBlock(blockNum: number) {
        const rawBlock: any = await this.call('/v1/chain/get_block', {block_num_or_id: blockNum})
        const transactions: Transaction[] = []
        for (const {trx} of rawBlock.transactions) {
            if (typeof trx === 'string') {
                transactions.push({id: trx, actions: []})
                continue
            }
            const actions: Action[] = []
            for (const rawAction of trx.transaction.actions) {
                const {account, name, authorization, data} = rawAction
                if (this.useWhitelist && !this.whitelist.has(account)) {
                    continue
                }
                actions.push({
                    account,
                    name,
                    authorization,
                    data: typeof data === 'string' ? await this.resolveData(rawAction) : data,
                })
            }
            transactions.push({id: trx.id, actions})
            this.txIndex.set(trx.id, blockNum)
        }
        const block: Block = {
            block_num: blockNum,
            transactions,
        }
        this.blockCache.set(blockNum, block)
        return block
    }

    private async resolveData(rawAction: any) {
        let contract = this.contracts.get(rawAction.account)
        if (contract === null) {
            return {}
        }
        if (!contract) {
            const {abi} = await this.rpc.get_abi(rawAction.account)
            if (!abi) {
                this.contracts.set(rawAction.account, null)
                return {}
            }
            contract = getContract(abi)
            this.contracts.set(rawAction.account, contract)
        }
        const type = contract.actions.get(rawAction.name)
        if (!type) {
            // contract has invalid or non-backwards compatible ABI
            return {}
        }
        const buffer = new Serialize.SerialBuffer({
            array: Serialize.hexToUint8Array(rawAction.data),
        })
        return type.deserialize(buffer)
    }

    private async call(path: string, payload: any, maxTries = 3) {
        let tries = 0
        let rv: any
        while (true) {
            try {
                rv = await this.rpc.fetch(path, payload)
                break
            } catch (error) {
                // TODO: fail early for unrecoverable errors
                if (++tries >= maxTries) {
                    throw error
                }
                await sleep(100)
            }
        }
        return rv
    }
}

/** Helper that creates a contract representation from an abi for the eosjs serializer. */
function getContract(contractAbi: any): Serialize.Contract {
    const types = Serialize.getTypesFromAbi(Serialize.createInitialTypes(), contractAbi)
    const actions = new Map<string, Serialize.Type>()
    for (const {name, type} of contractAbi.actions) {
        actions.set(name, Serialize.getType(types, type))
    }
    return {types, actions}
}
