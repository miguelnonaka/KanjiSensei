#!/usr/bin/env bash
set -euo pipefail

for command_name in adb scrcpy; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    printf 'Comando ausente: %s. Instale adb e scrcpy no Linux.\n' "$command_name" >&2
    exit 1
  fi
done

adb start-server >/dev/null
mapfile -t connected_devices < <(adb devices | awk 'NR > 1 && $2 == "device" { print $1 }')

if ((${#connected_devices[@]} == 0)); then
  printf 'Nenhum Android autorizado. Ative Depuração USB, conecte o cabo e aceite a chave RSA.\n' >&2
  exit 1
fi

serial="${1:-${connected_devices[0]}}"
if (($# > 0)); then shift; fi
exec scrcpy --serial "$serial" "$@"