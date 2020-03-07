import * as ABI from '../contract/types'
import {DataProvider, TableQuery} from './data-providers'
import {i64tohex, nametohex} from './utils'

interface ApiClientOptions {
    /** Data provider instance or URL to EOS node. */
    dataProvider: DataProvider
    /** Contract account, defaults to `decentiumorg`. */
    contract?: string
}

export class ApiClient {
    public readonly dataProvider: DataProvider
    public readonly contractAccount: string

    constructor(options: ApiClientOptions) {
        this.dataProvider = options.dataProvider
        this.contractAccount = options.contract || 'decentiumorg'
    }

    /** Lookup a Decentium blog on author name, returns null if no blog is found. */
    public async getBlog(author: string) {
        const {rows} = await this.dataProvider.getTableRows<ABI.BlogRow>({
            code: this.contractAccount,
            scope: this.contractAccount,
            table: 'blogs',
            lower_bound: author,
            upper_bound: author,
            key_type: 'name',
            index_position: '0',
            limit: 1,
        })
        return rows[0] ? rows[0] : null
    }

    public async getProfile(author: string | ABI.TxRef) {
        let ref: ABI.TxRef | undefined
        if (typeof author === 'string') {
            const blog = await this.getBlog(author)
            if (blog && blog.profile) {
                ref = blog.profile
            }
        } else {
            ref = author
        }
        if (ref) {
            return this.resolveProfile(ref)
        }
        return null
    }

    /** Get post refs for a blog */
    public async getPosts(author: string, from?: string, limit = 20) {
        const req: TableQuery = {
            code: this.contractAccount,
            scope: author,
            table: 'posts',
            limit: limit + 1,
            key_type: 'i64',
            index_position: '2',
            encode_type: 'dec',
            reverse: true,
        }
        if (from) {
            req.lower_bound = 0
            req.upper_bound = String(parseInt(from, 10))
        }
        const {rows} = await this.dataProvider.getTableRows(req)
        const posts = (rows as ABI.PostRow[])
            .map((row) => {
                return row.ref
            })
            .slice(0, limit)
        let next: string | null = null
        if (limit < rows.length) {
            const nextRef = rows[rows.length - 1].ref
            next = (new Date(nextRef.timestamp + 'Z').getTime() / 1000).toFixed(0)
        }
        return {posts, next}
    }

    /** Fetch trending feed. */
    public async getTrending(opts: {from?: number, category?: string, limit?: number} = {}) {
        const limit = opts.limit || 20
        const req: TableQuery = {
            code: this.contractAccount,
            scope: this.contractAccount,
            table: 'trending',
            limit: limit + 1,
            key_type: opts.category ? 'i128' : 'i64',
            index_position: opts.category ? '3' : '2',
            encode_type: 'hex', // ignored for i64..
            reverse: true,
        }
        if (opts.from && isFinite(opts.from)) {
            req.lower_bound = 0
            req.upper_bound = opts.from
        }
        if (opts.category) {
            const categoryhex = nametohex(opts.category)
            const upperhex = req.upper_bound ? i64tohex(req.upper_bound) : 'ffffffffffffffff'
            req.lower_bound = '0x0000000000000000' + categoryhex
            req.upper_bound = '0x' + upperhex + categoryhex
        }
        const {rows} = await this.dataProvider.getTableRows(req)
        const posts = (rows as ABI.TrendingRow[]).map((row) => row.ref).slice(0, limit)
        let next: string | null = null
        if (limit < rows.length) {
            next = rows[rows.length - 1].score
        }
        return {posts, next}
    }

    /** Find and resolve a Decentium post. */
    public async getPost(permlink: ABI.Permlink) {
        const postRef = await this.getPostRef(permlink)
        if (postRef) {
            return this.resolvePost(postRef)
        }
        return null
    }

    /** Get a post reference. */
    public async getPostRef(permlink: ABI.Permlink) {
        const req: TableQuery = {
            code: this.contractAccount,
            scope: permlink.author,
            table: 'posts',
            limit: 1,
            key_type: 'name',
            index_position: '1',
            upper_bound: permlink.slug,
            lower_bound: permlink.slug,
        }
        const {rows} = await this.dataProvider.getTableRows<ABI.PostRow>(req)
        return rows[0] ? rows[0].ref : null
    }

    /** Resolve a Decentium post. */
    public async resolvePost(ref: ABI.PostRef) {
        const tx = await this.getTransaction(ref.edit_tx || ref.tx)
        const action = tx.actions.find((a) => a.account === this.contractAccount && a.name === 'post')
        if (!action) {
            throw new Error('Post ref points to invalid tx')
        }
        return action.data as ABI.ActionPost
    }

    public async resolveProfile(ref: ABI.TxRef) {
        const tx = await this.getTransaction(ref)
        const action = tx.actions.find((a) => a.account === this.contractAccount && a.name === 'profile')
        if (!action) {
            throw new Error('Profile ref points to invalid tx')
        }
        return action.data as ABI.ActionProfile
    }

    private async getTransaction(ref: ABI.TxRef) {
        return this.dataProvider.getTransaction(ref.transaction_id, ref.block_num)
    }
}
