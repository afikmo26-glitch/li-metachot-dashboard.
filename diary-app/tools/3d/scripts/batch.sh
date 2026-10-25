#!/bin/bash
# runs the pipeline (model + rig, one cheap anim to trigger the rig step is NOT used: we pass a marker) for each name
cd "$(dirname "$0")"
for n in "$@"; do
  python3 -I tripo.py "$n" "${n}_in.png" RIGONLY >> "log_$n.txt" 2>&1
  echo "$n exit $?" >> batch.log
done
