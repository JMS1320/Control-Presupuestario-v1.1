#!/bin/bash
# 🚦 ¿Vercel publica este push? (JMS 01/11: «para no colapsar Vercel gratuito»; tope del plan: 100 publicaciones por día).
# Vercel corre esto antes de armar: si sale con 0 NO publica; con 1 publica.
#
# NO publica:
#  - las ramas jms/* (terminales en paralelo): se prueban cuando llegan a `desarrollo`;
#  - un push que sólo cambió documentación (*.md) o scripts SQL de la base: la app es la misma.
# Todo lo demás publica (incluidas las ramas de Javier y `main`).

rama="$VERCEL_GIT_COMMIT_REF"
case "$rama" in
  jms/*) echo "🚦 Rama de una terminal en paralelo ($rama): no se publica."; exit 0 ;;
esac

# Sin commit anterior para comparar (primer push, clon corto): se publica por las dudas.
if ! git rev-parse --verify --quiet HEAD^ >/dev/null; then echo "🚦 Sin commit anterior: se publica."; exit 1; fi

if git diff --quiet HEAD^ HEAD -- . ':(exclude)*.md' ':(exclude)scripts/*.sql'; then
  echo "🚦 Sólo cambió documentación o scripts de la base: no se publica."
  exit 0
fi
echo "🚦 Cambió la app: se publica."
exit 1
