
SHELL := /bin/bash
PATH  := ./node_modules/.bin:$(PATH)

SRC_FILES := $(shell find src -name '*.ts')

lib: $(SRC_FILES) node_modules tsconfig.json rollup.config.js
	rollup -c &&\
	cp src/decentium.d.ts lib/ &&\
	touch lib

node_modules:
	yarn install --non-interactive --frozen-lockfile

.PHONY: abi-types
abi-types: node_modules
	cleos -u https://eos.greymass.com get abi decentiumorg | eosio-abi2ts -e > src/decentium.d.ts

.PHONY: lint
lint: node_modules
	NODE_ENV=test tslint -p tsconfig.json -c tslint.json -t stylish --fix

.PHONY: test
test: node_modules
	TS_NODE_PROJECT=test/tsconfig.json \
	mocha --require ts-node/register test/*.ts --grep '$(grep)'

.PHONY: coverage
coverage: node_modules
	TS_NODE_PROJECT=test/tsconfig.json \
	nyc -r html -r text -e .ts -i ts-node/register mocha --reporter nyan --require ts-node/register test/*.ts

.PHONY: clean
clean:
	rm -rf lib/ coverage/ .nyc_output/

.PHONY: distclean
distclean: clean
	rm -rf node_modules/
