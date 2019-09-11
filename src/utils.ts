import {Serialize} from 'eosjs'
import * as ABI from './decentium'

/**
 * Sleep for N milliseconds.
 */
export function sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, ms)
    })
}

const types = Serialize.createInitialTypes()

export function nametohex(name: string) {
    const buffer = new Serialize.SerialBuffer()
    types.get('name')!.serialize(buffer, name)
    return Serialize.arrayToHex(buffer.asUint8Array()).toLowerCase()
}

export function i64tohex(value: number) {
    const buffer = new Serialize.SerialBuffer()
    types.get('uint64')!.serialize(buffer, value)
    return Serialize.arrayToHex(buffer.asUint8Array()).toLowerCase()
}

export function stringToName(name: string) {
    const buffer = new Serialize.SerialBuffer()
    const nameType = types.get('name')!
    nameType.serialize(buffer, name)
    buffer.readPos = 0
    return nameType.deserialize(buffer)
}

export function isName(value: string) {
    return /^[a-z1-5.]{1,13}$/.test(value)
}

export function isPermlink(value: string) {
    try {
        parsePermlink(value)
        return true
    } catch (error) {
        return false
    }
}

export function parsePermlink(value: string | {author: string; slug: string}): ABI.Permlink {
    let author: string
    let slug: string
    if (typeof value === 'string') {
        [author, slug] = value.split('/')
    } else {
        author = value.author
        slug = value.slug
    }
    if (typeof slug !== 'string') {
        throw new Error('Invalid permlink')
    }
    slug = slug.replace(/\-/g, '.')
    if (typeof author !== 'string' || !isName(author) || !isName(slug)) {
        throw new Error('Invalid permlink')
    }
    return {
        author,
        slug,
    }
}

export function encodePermlink(value: ABI.Permlink) {
    return `${value.author}/${value.slug.replace(/\./g, '-')}`
}
