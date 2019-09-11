import 'mocha'

import * as assert from 'assert'
import { JsonRpc } from 'eosjs'

import * as ABI from '../contract/types'
import { ApiClient } from '../src/api-client'
import { EosjsDataProvider } from '../src/data-providers/eosjs'

const Replay = require('replay')
Replay.fixtures = __dirname + '/fixtures'

const rpc = new JsonRpc('https://eos.greymass.com', { fetch: require('node-fetch') })
// TODO: use a mock provider
const dataProvider = new EosjsDataProvider(rpc, { whitelist: ['decentiumorg'] })
const client = new ApiClient({ dataProvider })

const GenesisPostRef: any = {
    permlink: { author: 'almstdigital', slug: 'hello.world' },
    timestamp: '2019-05-25T01:48:09',
    category: 'decentium',
    options: 3,
    tx: {
        block_num: 59923115,
        transaction_id: '0ef9aa310e6e7efb7b10192dc80e5b09826c4369be6b1ba54990b8a66302500e',
    },
    edit_tx: null,
    endorsements: { count: 0, amount: 0 },
    extensions: [],
}

describe('api client', function() {
    it('should get blog', async function() {
        const blog = await client.getBlog('almstdigital')
        assert(blog !== null, 'blog not found')
        assert.equal(blog!.author, 'almstdigital')
    })
    it('should get blog posts', async function() {
        const result = await client.getPosts('almstdigital', '1558748889', 1)
        assert.equal(result.next, null)
        assert.equal(result.posts.length, 1)
        assert.deepEqual(result.posts[0], GenesisPostRef)
    })
    it('should resolve blog post', async function() {
        const result = await client.resolvePost(GenesisPostRef)
        assert.equal(result.author, 'almstdigital')
        assert.equal(result.title, 'Hello World')
    })
    it('should resolve blog post by permlink', async function() {
        const result = await client.getPost(GenesisPostRef.permlink)
        assert(result !== null, 'post not found')
        assert.equal(result!.author, 'almstdigital')
        assert.equal(result!.title, 'Hello World')
    })
    it('should get and resolve profile', async function() {
        const r1 = await client.getProfile('almstdigital')
        assert(r1 !== null, 'profile not found')
        assert.equal(r1!.author, 'almstdigital')
        const r2 = await client.getProfile({
            block_num: 59916086,
            transaction_id: '19af4c99be8b7a112416fc78417ff1cf6fbfdf3de86e923c976a6142f218e90c',
        })
        assert(r2 !== null, 'profile not found')
        assert.equal(r2!.author, 'almstdigital')
    })
    it('should get trending feeds', async function() {
        const all = await client.getTrending()
        assert.equal(all.posts.length, 20)
        assert.equal(typeof all.next, 'number')
        // TODO: this will start failing when feeds are pruned and http fixtures are renewed
        const decentium = await client.getTrending(99487, 'decentium', 1)
        assert.equal(decentium.posts.length, 1)
        assert.equal(decentium.posts[0].category, 'decentium')
        assert.deepEqual(decentium.posts[0].permlink, { author: 'almstdigital', slug: 'hello.world' })
    })
})
