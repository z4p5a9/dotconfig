#!/bin/bash

max=50

raw="$(basename "$(dirname "$PWD")")/$(basename "$PWD")"

if [ "${#raw}" -gt "$max" ]; then
  session="${raw: -$((max))}"
else
  session="$raw"
fi

if [[ -z "$TMUX" ]]; then
  tmux new -A -s "$session"
fi
