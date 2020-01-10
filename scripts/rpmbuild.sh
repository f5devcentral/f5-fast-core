#!/bin/bash
set -e

MAINDIR=$(pwd)

FULL_VERSION=$(node -e "console.log(require('./package.json').version)")
VERSION=$(echo $FULL_VERSION | cut -d - -f 1)
RELEASE=$(echo $FULL_VERSION | cut -d - -f 2)
PKG_NAME=$(node -e "console.log(require('./package.json').name);")
MYSTIQUE_PKG_NAME=$(node -e "console.log(require('./../core/package.json').name);")
MYSTIQUE_PKG_VER=$(node -e "console.log(require('./../core/package.json').version)")
MYSTIQUE_PKG=${MYSTIQUE_PKG_NAME}-${MYSTIQUE_PKG_VER}.tgz
OUTPUT_DIR=${MAINDIR}/dist

rpmbuild -bb \
    --define "main ${MAINDIR}" \
    --define '_topdir %{main}/rpmbuild' \
    --define "_name ${PKG_NAME}" \
    --define "_version ${VERSION}" \
    --define "_release ${RELEASE}" \
    --define "_mystiquepkg ${MYSTIQUE_PKG}" \
    project.spec

cd rpmbuild/RPMS/noarch
rpmFile=$(ls -t *.rpm 2>/dev/null | head -1)
mkdir -p ${OUTPUT_DIR}
cp ${rpmFile} ${OUTPUT_DIR}
sha256sum "${rpmFile}" > "${OUTPUT_DIR}/${rpmFile}.sha256"