#!/bin/bash
cd /Users/simoncarr/dev/ims/client-bullmq-worker
npm run build > build_output.log 2>&1
echo "Build completed, output saved to build_output.log"
