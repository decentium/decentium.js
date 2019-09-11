
# decentiumjs [![Package Version](https://img.shields.io/npm/v/decentium.svg?style=flat-square)](https://www.npmjs.com/package/decentium)

JavaScript library for interacting with the decentralized publishing platform [Decentium](https://decentium.org).


Installing
----------

With Yarn:

```
yarn add decentium
```

With NPM:

```
npm install --save decentium
```


Example
-------

Fetch the top post in a category and render it as HTML to stdout using Node.js:

```js
const {ApiClient, EosjsDataProvider, render} = require('decentium')
const {JsonRpc} = require('eosjs')
const fetch = require('node-fetch')

const rpc = new JsonRpc('https://eos.greymass.com', {fetch})
const dataProvider = new EosjsDataProvider(rpc)
const client = new ApiClient({dataProvider})

async function main() {
    const trending = await client.getTrending({category: 'art', limit: 1})
    const post = await client.resolvePost(trending.posts[0])
    console.log(render(post.doc))
}

main().catch((error) => console.warn(error))
```
