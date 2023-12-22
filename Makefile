build:
	npm run build
test: build 
	npm run test
publish: build
	npm publish --access public

