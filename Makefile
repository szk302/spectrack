.PHONY: show-next-version-auto show-next-version-patch show-next-version-minor show-next-version-major

show-next-version-auto:
	@git cliff --bumped-version 2>/dev/null | sed 's/^v//'

show-next-version-patch:
	@node -e "const p=JSON.parse(require('fs').readFileSync('package.json','utf8')); \
	const [ma,mi,pa]=p.version.split('.').map(Number); \
	console.log(ma+'.'+mi+'.'+(pa+1))"

show-next-version-minor:
	@node -e "const p=JSON.parse(require('fs').readFileSync('package.json','utf8')); \
	const [ma,mi]=p.version.split('.').map(Number); \
	console.log(ma+'.'+(mi+1)+'.0')"

show-next-version-major:
	@node -e "const p=JSON.parse(require('fs').readFileSync('package.json','utf8')); \
	const [ma]=p.version.split('.').map(Number); \
	console.log((ma+1)+'.0.0')"

bump-version-%:
	@node -e " \
	const fs=require('fs'); \
	const p=JSON.parse(fs.readFileSync('package.json','utf8')); \
	p.version='$*'; \
	fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n'); \
	console.log('Bumped to $*')"
	@git add package.json

gen-changelog-%:
	@git cliff --tag $* -o CHANGELOG.md
