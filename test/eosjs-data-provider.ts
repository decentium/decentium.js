import 'mocha'

import * as assert from 'assert'
import { JsonRpc } from 'eosjs'

import { EosjsDataProvider } from '../src/data-providers/eosjs'

const Replay = require('replay')
Replay.fixtures = __dirname + '/fixtures'

const fetch = require('node-fetch')

let BLOCK_RPC_FETCH = false
const rpc = new JsonRpc('https://eos.greymass.com', { fetch: async (...args) => {
    if (BLOCK_RPC_FETCH) {
        throw new Error('You shall not pass')
    }
    return fetch(...args)
}})
const provider = new EosjsDataProvider(rpc, {whitelist: ['decentiumorg']})

describe('eosjs data provider', function() {
    it('should find and decode transaction', async function() {
        const tx = await provider.getTransaction(
            '0ef9aa310e6e7efb7b10192dc80e5b09826c4369be6b1ba54990b8a66302500e',
            59923115,
        )
        assert.equal(tx.id, '0ef9aa310e6e7efb7b10192dc80e5b09826c4369be6b1ba54990b8a66302500e')
        assert.equal(tx.actions.length, 1)
        assert.deepEqual(tx.actions[0], {
            account: 'decentiumorg',
            name: 'post',
            authorization: [
                {
                    actor: 'almstdigital',
                    permission: 'active',
                },
            ],
            data: {
                author: 'almstdigital',
                title: 'Hello World',
                doc: {
                    content: [
                        [
                            'paragraph',
                            {
                                content: [
                                    [
                                        'text',
                                        {
                                            value: 'For Hanna Rey, may the world you grow up in be as bright as you.',
                                            marks: [
                                                [
                                                    'italic',
                                                    {},
                                                ],
                                            ],
                                        },
                                    ],
                                ],
                            },
                        ],
                    ],
                },
                metadata: {
                    image: null,
                    summary: 'Welcome to Decentium',
                    image_info: [],
                },
            },
        })
    })

    it('should cache transactions', async function() {
        this.slow(500)
        const tx = await provider.getTransaction(
            'a160f653034b70099e0eec7b321b133333a850a887c5e09a1a665ec28f7e1068',
            60151692,
        )
        assert.equal(tx.actions[0].authorization[0].actor, 'decentiumcrw')
        BLOCK_RPC_FETCH = true
        await provider.getTransaction(
            'a160f653034b70099e0eec7b321b133333a850a887c5e09a1a665ec28f7e1068',
            60151692,
        )
        await assert.rejects(
            provider.getTransaction(
                'beeffacebeeffacebeeffacebeeffacebeeffacebeeffacebeeffacebeefface',
                123456,
            ),
            /You shall not pass/,
        )
        provider.blockCache.maxAge = 1
        provider.blockCache.prune()
        await assert.rejects(
            provider.getTransaction(
                'a160f653034b70099e0eec7b321b133333a850a887c5e09a1a665ec28f7e1068',
                60151692,
            ),
            /You shall not pass/,
        )
        assert.equal((provider as any).txIndex.length, 0)
        BLOCK_RPC_FETCH = false
    })

})
