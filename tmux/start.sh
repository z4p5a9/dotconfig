#!/bin/bash

max=50

raw="$(basename "$(dirname "$PWD")")/$(basename "$PWD")"

if [ "${#raw}" -gt "$max" ]; then
  session="${raw: -$((max))}"
else
  session="$raw"
fi

if [[ -z "$TMUX" ]]; then
  if tmux has-session -t "$session" 2>/dev/null; then
    tmux attach -t "$session"
  elif tmux list-sessions >/dev/null 2>&1; then
    tmux attach
  else
    tmux new -s "$session"
  fi
fi
