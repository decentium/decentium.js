import 'mocha'

import * as assert from 'assert'
import * as fs from 'fs'

import * as ABI from '../contract/types'
import render, { renderBlock, renderInline } from '../src/render'

const p = (content: ABI.VariantInlineNodes[]) =>
    ['paragraph', { content }] as ABI.VariantBlockNodes
const text = (value: string, marks: ABI.VariantMarkNodes[] = []) =>
    ['text', { value, marks }] as ABI.VariantInlineNodes

describe('inline renderer', function() {
    it('should escape html', function() {
        assert.equal(
            renderInline([text('Hello<script>"xss"</script><img src="fail" onerror="xss"/>')]),
            'Hello&lt;script&gt;"xss"&lt;/script&gt;&lt;img src="fail" onerror="xss"/&gt;',
        )
    })
    it('should prioritize link marks', function() {
        const marks: ABI.VariantMarkNodes[] = [
            ['bold', {}],
            ['code', {}],
            ['link', { href: 'https://example.com', title: 'Example' }],
        ]
        assert.equal(
            renderInline([text('foo', marks)]),
            '<a href="https://example.com" title="Example">foo</a>',
        )
    })
    it('should prioritize code marks', function() {
        const marks: ABI.VariantMarkNodes[] = [
            ['bold', {}],
            ['code', {}],
        ]
        assert.equal(
            renderInline([text('foo', marks)]),
            '<code>foo</code>',
        )
    })
    it('should add style marks in correct order', function() {
        const marks1: ABI.VariantMarkNodes[] = [
            ['bold', {}],
            ['strike', {}],
            ['italic', {}],
        ]
        const marks2: ABI.VariantMarkNodes[] = [
            ['italic', {}],
            ['strike', {}],
            ['bold', {}],
        ]
        const expected = '<strong><em><del>foo</del></em></strong>'
        assert.equal(renderInline([text('foo', marks1)]), expected)
        assert.equal(renderInline([text('foo', marks2)]), expected)
    })
    it('should not add marks to empty text', function() {
        const marks: ABI.VariantMarkNodes[] = [
            ['strike', {}],
            ['italic', {}],
        ]
        assert.equal(
            renderInline([text('', marks)]),
            '',
        )
    })
    it('should throw on unknown mark', function() {
        assert.throws(() => {
            const marks: any[] = [
                ['bold', {}],
                ['foo', {}],
            ]
            renderInline([text('foo', marks)])
        }, /Encountered unknown mark/)
    })
    it('should throw on unknown node', function() {
        assert.throws(() => {
            renderInline(['foo', {}] as any)
        }, /Encountered unknown inline node/)
    })
})

describe('block renderer', function() {

    it('should throw on unknown node', function() {
        assert.throws(() => {
            renderBlock(['foo', {}] as any)
        }, /Encountered unknown block node/)
    })

    describe('paragraph', function() {
        it('should omit empty', function() {
            assert.equal(renderBlock(p([])), undefined)
        })
        it('should render inline', function() {
            assert.equal(
                renderBlock(
                    p([
                        text('foo'),
                        ['hard_break', {}],
                        text('bar '),
                        text('baz', [['bold', {}]]),
                    ],
                    )),
                '<p>foo<br>bar <strong>baz</strong></p>',
            )
        })
    })

    describe('heading', function() {
        it('should omit empty', function() {
            assert.equal(renderBlock(['heading', { value: '', level: 1 }]), undefined)
        })
        it('should render and clamp level', function() {
            assert.equal(renderBlock(['heading', { value: 'foo', level: -99 }]), '<h1>foo</h1>')
            assert.equal(renderBlock(['heading', { value: 'foo', level: 0 }]), '<h1>foo</h1>')
            assert.equal(renderBlock(['heading', { value: 'foo', level: 1 }]), '<h1>foo</h1>')
            assert.equal(renderBlock(['heading', { value: 'foo', level: 2 }]), '<h2>foo</h2>')
            assert.equal(renderBlock(['heading', { value: 'foo', level: 3 }]), '<h3>foo</h3>')
            assert.equal(renderBlock(['heading', { value: 'foo', level: 10 }]), '<h3>foo</h3>')
        })
        it('should only render title as h1', function() {
            const ctx: any = {}
            assert.equal(renderBlock(['heading', { value: 'foo', level: 1 }], ctx), '<h1>foo</h1>')
            assert.equal(renderBlock(['heading', { value: 'foo', level: 1 }], ctx), '<h2>foo</h2>')
        })
        it('should only render title when first or below first image', function() {
            assert.equal(renderBlock(['heading', { value: 'foo', level: 1 }], { numSections: 1 }), '<h2>foo</h2>')
            assert.equal(renderBlock(['heading', { value: 'foo', level: 1 }], { numImages: 1 }), '<h1>foo</h1>')
            assert.equal(renderBlock(['heading', { value: 'foo', level: 1 }], { numImages: 2 }), '<h2>foo</h2>')
        })
    })

    describe('image', function() {
        it('should render', function() {
            assert.equal(
                renderBlock(['image', { src: 'https://example.com/image.jpg', caption: [], layout: 1 }]),
                '<figure><img src="https://example.com/image.jpg" alt=""></figure>',
            )
        })
        it('should render with caption', function() {
            assert.equal(
                renderBlock(['image', {
                    src: 'https://example.com/image.jpg',
                    layout: 1,
                    caption: [
                        text('foo', [['bold', {}], ['italic', {}]]),
                        text(' '),
                        text('bar', [['link', { href: 'https://example.com', title: 'Example' }]]),
                    ],
                }]),
                '<figure><img src="https://example.com/image.jpg" alt=""><figcaption><strong><em>foo</em></strong> <a href="https://example.com" title="Example">bar</a></figcaption></figure>',
            )
        })
    })

    describe('divider', function() {
        it('should render', function() {
            assert.equal(
                renderBlock(['divider', {}]),
                '<hr>',
            )
        })
    })

    describe('list', function() {
        it('should render bullet', function() {
            assert.equal(
                renderBlock(['list', {
                    type: 0,
                    items: [
                        {content: [text('foo')]},
                        {content: [text('bar')]},
                    ],
                }]),
                '<ul><li>foo</li><li>bar</li></ul>',
            )
        })
        it('should render numbered', function() {
            assert.equal(
                renderBlock(['list', {
                    type: 1,
                    items: [
                        {content: [text('foo')]},
                        {content: [text('bar')]},
                    ],
                }]),
                '<ol><li>foo</li><li>bar</li></ol>',
            )
        })
    })

    describe('code block', function() {
        it('should render', function() {
            assert.equal(
                renderBlock(['code_block', {
                    code: 'if (10 > foo) { let x = "bar" }',
                    lang: 'js',
                }]),
                '<pre><code data-lang="js">if (10 &gt; foo) { let x = "bar" }</code></pre>',
            )
        })
    })

    describe('quote', function() {
        it('should render', function() {
            assert.equal(
                renderBlock(['quote', {
                    content: [text('foo')],
                }]),
                '<blockquote>foo</blockquote>',
            )
        })
    })

    describe('linkref', function() {
        it('should render', function() {
            assert.equal(
                renderBlock(['linkref', {
                    to: {author: 'foo', slug: 'bar.baz'},
                }]),
                '<p><a href="https://decentium.org/foo/bar-baz">https://decentium.org/foo/bar-baz</a></p>',
            )
        })
    })
})

describe('render', function() {

    const testPairs: Array<{doc: ABI.Document, html: string}> = []
    before(function() {
        const files = fs.readdirSync('./test/documents')
        const jsonFiles = files.filter((f) => /\.json$/.test(f))
        const htmlFiles = files.filter((f) => /\.html$/.test(f))
        for (let i = 0; i < jsonFiles.length; i++) {
            const doc = JSON.parse(fs.readFileSync('./test/documents/' + jsonFiles[i]).toString('utf8'))
            const html = fs.readFileSync('./test/documents/' + htmlFiles[i]).toString('utf8')
            testPairs.push({doc, html})
        }
    })

    it('should render test documents', function() {
        assert(testPairs.length > 0)
        for (const {doc, html} of testPairs) {
            assert.equal(render(doc), html)
        }
    })

})
