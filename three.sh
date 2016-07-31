#!/bin/bash

# Downloads THREE core library and some auxiliary files,
# minimizes them into a single file and deploys at /src/three/three.batch.js.
# Requires uglifyjs installed globally.

TMP=tmp

if [[ ! -d $TMP ]]; then
	mkdir $TMP
fi

THREE_ROOT=https://github.com/mrdoob/three.js/raw/r73
THREE_EX=$THREE_ROOT/examples/js

FILES="$THREE_ROOT/build/three.min.js \
	$THREE_EX/libs/stats.min.js \
	$THREE_EX/controls/OrbitControls.js \
	$THREE_EX/shaders/CopyShader.js \
	$THREE_EX/postprocessing/RenderPass.js \
	$THREE_EX/postprocessing/ShaderPass.js \
	$THREE_EX/postprocessing/MaskPass.js \
	$THREE_EX/postprocessing/EffectComposer.js"

LOCAL_FILES=
for f in $FILES; do
	BASENAME=$TMP/`basename "$f"`
	wget -O $BASENAME $f
	LOCAL_FILES+=" $BASENAME"
done

uglifyjs $LOCAL_FILES > $TMP/three.batch.js
mv $TMP/three.batch.js src/three/three.batch.js
