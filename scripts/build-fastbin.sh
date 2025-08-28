#!/bin/bash
set -eu

version=$(./scripts/getversion.sh)
outdir=./dist
targets=node22-win,node22-macos,node22-linux,node22-alpine

# Generate binaries
pkg . -t ${targets} -o "${outdir}/fast-${version}"

# Generate sha256 hashes
cd "${outdir}"
for bin in $(ls "fast-${version}-"*)
do
    sha256sum "${bin}" > "${bin}.sha256"
done
