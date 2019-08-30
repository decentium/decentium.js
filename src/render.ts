import {cssFilter, escapeAttrValue, escapeHtml, safeAttrValue as _safeAttrValue} from 'xss'
import * as ABI from './decentium'

interface RenderContext {
    numSections?: number
    numImages?: number
}

const markOrder = ['link', 'code', 'bold', 'italic', 'strike']
const marksByOrder = (a: ABI.VariantMarkNodes, b: ABI.VariantMarkNodes) => {
    return markOrder.indexOf(a[0]) - markOrder.indexOf(b[0])
}

function safeAttrValue(tag: string, attr: string, value: string) {
    // xss module disallows all data urls
    // this adds an expection for image tags that have
    // data urls with an image/* content-type
    if (
        tag === 'img' &&
        attr === 'src' &&
        typeof value === 'string' &&
        value.startsWith('data:image/')
    ) {
        return escapeAttrValue(value)
    }
    return _safeAttrValue(tag, attr, value, cssFilter)
}

export function renderInline(nodes: ABI.VariantInlineNodes[]) {
    // FUTURE: could optimize here by collapsing marks, e.g.
    //         <i><b>foo</b></i><b>bar</b> => <b><i>foo</i>bar</b>
    const renderMarks = (marks: ABI.VariantMarkNodes[], open: boolean) => {
        if (marks.length === 0) {
            return ''
        }
        const sortedMarks = marks.slice().sort(marksByOrder)
        const firstMark = sortedMarks[0]
        if (firstMark[0] === 'link') {
            const link = firstMark[1] as ABI.Link
            if (open) {
                let a = `<a href="${ safeAttrValue('a', 'href', link.href) }"`
                if (link.title.length > 0) {
                    a += ` title="${ safeAttrValue('a', 'title', link.title) }"`
                }
                a += '>'
                return a
            } else {
                return '</a>'
            }
        } else if (firstMark[0] === 'code') {
            if (open) {
                return '<code>'
            } else {
                return '</code>'
            }
        } else {
            let tags = ''
            const styleMarks = open ? sortedMarks : sortedMarks.reverse()
            for (const [mark] of styleMarks) {
                let tag: string
                switch (mark) {
                    case 'bold':
                        tag = 'strong'
                        break
                    case 'italic':
                        tag = 'em'
                        break
                    case 'strike':
                        tag = 'del'
                        break
                    default:
                        throw new Error(`Encountered unknown mark '${ mark }'`)
                }
                tags += open ? '<' : '</'
                tags += tag + '>'
            }
            return tags
        }
    }
    const rv: string[] = []
    for (const node of nodes) {
        const [type, data] = node
        switch (type) {
            case 'text':
                const text = data as ABI.Text
                if (text.value.length === 0) {
                    // don't add marks for empty text nodes
                    break
                }
                rv.push(renderMarks(text.marks, true))
                rv.push(escapeHtml(text.value))
                rv.push(renderMarks(text.marks, false))
                break
            case 'hard_break':
                rv.push('<br>')
                break
            default:
                throw new Error(`Encountered unknown inline node '${ type }'`)
        }
    }
    return rv.join('')
}

export function renderBlock(node: ABI.VariantBlockNodes, ctx: RenderContext = {}) {
    let rv: string
    const [type, data] = node
    switch (type) {
        case 'paragraph':
            const paragraph = data as ABI.Paragraph
            if (paragraph.content.length === 0) {
                return
            }
            rv = `<p>${ renderInline(paragraph.content) }</p>`
            break
        case 'heading':
            const heading = data as ABI.Heading
            if (heading.value.length === 0) {
                return
            }
            let level = Math.min(Math.max(1, heading.level), 3)
            // first heading is title and can only be preceded by an image
            if (ctx.numSections || (ctx.numImages || 0) > 1) {
                level += 1
            }
            rv = `<h${ level }>${ escapeHtml(heading.value) }</h${ level }>`
            break
        case 'divider':
            rv = '<hr>'
            break
        case 'image':
            // TODO: use image info if provided to build placeholder and set image size
            const image = data as ABI.Image
            rv = '<figure>'
            rv += `<img src="${ safeAttrValue('img', 'src', image.src) }" alt="">`
            if (image.caption.length > 0) {
                rv += `<figcaption>${ renderInline(image.caption) }</figcaption>`
            }
            rv += '</figure>'
            break
        case 'quote':
            const quote = data as ABI.Quote
            rv = `<blockquote>${ renderInline(quote.content) }</blockquote>`
            break
        case 'linkref':
            // TODO: add inline post preview if provided in context
            // TODO: make base url configurable
            const linkref = data as ABI.Linkref
            const href = 'https://decentium.org' + `/${ linkref.to.author }/${ linkref.to.slug.replace(/\./g, '-') }`
            rv = `<p><a href="${ safeAttrValue('a', 'href', href) }">${ escapeHtml(href) }</a></p>`
            break
        case 'list':
            const list = data as ABI.List
            const tag = list.type === 0 ? 'ul' : 'ol'
            rv = `<${ tag }>`
            for (const item of list.items) {
                rv += `<li>${ renderInline(item.content) }</li>`
            }
            rv += `</${ tag }>`
            break
        case 'code_block':
            // TODO: syntax hl
            const codeBlock = data as ABI.CodeBlock
            rv = `<pre><code data-lang="${ safeAttrValue('code', 'data-lang', codeBlock.lang) }">${ escapeHtml(codeBlock.code) }</code></pre>`
            break
        default:
            throw new Error(`Encountered unknown block node '${ type }'`)
    }
    // keep track of text sections and images for determening if heading qualifies as title
    if (type === 'image') {
        ctx.numImages = (ctx.numImages || 0) + 1
    } else {
        ctx.numSections = (ctx.numSections || 0) + 1
    }
    return rv
}

/** Render Decentium document *doc* to HTML */
export default function render(doc: ABI.Document, ctx: RenderContext = {}): string {
    const chunks: string[] = []
    for (const node of doc.content) {
        const chunk = renderBlock(node, ctx)
        if (chunk) {
            chunks.push(chunk)
        }
    }
    const html = chunks.join('\n')
    return html
}
